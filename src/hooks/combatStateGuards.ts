/**
 * Combat state guards
 *
 * Foundry can end up in a partially-active combat state if all tokens are removed from a scene
 * without triggering the normal combat end lifecycle. In that case token indicators can still
 * refresh while the combat tracker UI (which depends on `game.combats.viewed`) fails to render.
 *
 * This hook set repairs that state by:
 * - Ending any active combat in a scene once it has no valid combatants/tokens remaining.
 * - Re-syncing the client's viewed combat to the active combat for the current canvas scene.
 */
let didRegisterCombatStateGuards = false;
type HookRegistration = { hook: string; id: number };
let hookIds: HookRegistration[] = [];

type SceneRef = { id: string };
type TokenRef = { parent?: SceneRef | null };

type CombatantRef = {
	sceneId: string;
	token: { id?: string } | null;
	tokenId?: string | null;
};

type CombatantsRef = { contents: CombatantRef[]; size: number };

type CombatRef = {
	id: string;
	active: boolean;
	scene?: SceneRef | null;
	combatants: CombatantsRef;
	delete: () => Promise<void>;
};

type CombatsCollectionLike = {
	contents?: CombatRef[];
	viewed?: CombatRef | null;
	viewCombat?: (combat: CombatRef | null, options?: { render?: boolean }) => void;
};

/**
 * Create a scheduler that runs the handler once per key
 * after Foundry finishes processing the current batch of updates.
 *
 * This prevents running cleanup logic N times during bulk operations
 * like mass token or combatant deletion.
 */
function createPostUpdateSchedulerPerKey<T>(handler: (value: T) => void | Promise<void>) {
	const scheduled = new Set<T>();
	return (value: T) => {
		if (scheduled.has(value)) return;
		scheduled.add(value);
		setTimeout(() => {
			scheduled.delete(value);
			void handler(value);
		}, 0);
	};
}

/**
 * Create a scheduler that runs the handler at most once
 * after Foundry finishes processing the current batch of updates.
 *
 * Used to collapse bursts of hooks (combat updates, canvas ready, etc.)
 * into a single reconciliation pass.
 */
function createPostUpdateScheduler(handler: () => void | Promise<void>) {
	let scheduled = false;
	return (_source?: string) => {
		if (scheduled) return;
		scheduled = true;
		setTimeout(() => {
			scheduled = false;
			void handler();
		}, 0);
	};
}

function isTokenBackedCombatant(combatant: CombatantRef, sceneId: string): boolean {
	if (combatant.sceneId !== sceneId) return false;

	return (combatant.tokenId != null && combatant.tokenId !== '') || combatant.token?.id != null;
}

function isCombatViewableForScene(combat: CombatRef, sceneId: string): boolean {
	return combat.combatants.contents.some((c) => isTokenBackedCombatant(c, sceneId));
}

function getCombatsContents(): CombatRef[] {
	const combats = game.combats as unknown as CombatsCollectionLike | null;
	return combats?.contents ?? [];
}

export function unregisterCombatStateGuards() {
	// Narrow the signature to avoid heavy overload resolution in Foundry's types.
	const off = Hooks.off as (hook: string, id: number) => void;

	for (const { hook, id } of hookIds) {
		off(hook, id);
	}
	hookIds = [];
	didRegisterCombatStateGuards = false;
}

export default function combatStateGuards() {
	// In dev/hot-reload scenarios `ready` can run more than once; make registration idempotent.
	if (didRegisterCombatStateGuards) return;
	didRegisterCombatStateGuards = true;

	function getActiveCombatForScene(sceneId: string): CombatRef | null {
		// Prefer the canonical active combat reference when possible.
		const active = game.combat as CombatRef | null;
		if (active?.active && active.scene?.id === sceneId) return active;

		// Look through the combats collection for an active combat in this scene.
		const byScene = getCombatsContents().find((c) => c.active && c.scene?.id === sceneId);
		if (byScene) return byScene;

		// Fallback: a viewed combat that is active for this scene.
		const viewed = (game.combats as unknown as CombatsCollectionLike | null)?.viewed ?? null;
		if (viewed?.active && viewed.scene?.id === sceneId) return viewed;

		return null;
	}

	async function endCombatIfPossible(combat: CombatRef): Promise<void> {
		if (!game.user?.isGM) return;

		const combatWithEnd = combat as CombatRef & { endCombat?: () => Promise<CombatRef> };
		if (typeof combatWithEnd.endCombat === 'function') {
			await combatWithEnd.endCombat();
			return;
		}

		// Fallback for older cores or unexpected overrides.
		await combat.delete();
	}

	function ensureViewedCombatForCurrentScene(): void {
		if (!canvas?.ready || !canvas.scene) return;

		const sceneId = canvas.scene.id;
		const activeCombat = getActiveCombatForScene(sceneId);
		const activeCombatIsViewable =
			activeCombat !== null && isCombatViewableForScene(activeCombat, sceneId);

		const combatsRaw = game.combats as unknown as CombatsCollectionLike | null;
		if (!combatsRaw?.viewCombat) return;

		const viewed = combatsRaw.viewed ?? null;

		const viewedIsValidForScene =
			viewed !== null && viewed.scene?.id === sceneId && isCombatViewableForScene(viewed, sceneId);

		// Active combat exists but is not viewable: clear the view.
		if (activeCombat && !activeCombatIsViewable) {
			if (viewed?.scene?.id === sceneId) {
				combatsRaw.viewCombat(null, { render: true });
			}
			return;
		}

		// Active, viewable combat should always be the viewed combat.
		if (activeCombatIsViewable && (!viewedIsValidForScene || viewed?.id !== activeCombat!.id)) {
			combatsRaw.viewCombat(activeCombat, { render: true });
			return;
		}

		// No active combat, but we're viewing something no longer viewable.
		if (!activeCombat && viewed?.scene?.id === sceneId && !viewedIsValidForScene) {
			combatsRaw.viewCombat(null, { render: true });
		}
	}

	async function cleanupSceneCombatState(sceneId: string): Promise<void> {
		try {
			const activeCombat = getActiveCombatForScene(sceneId);
			if (!activeCombat) {
				scheduleViewSync('cleanup:no-active-combat');
				return;
			}

			// Active combat with no token-backed combatants should be ended.
			if (!isCombatViewableForScene(activeCombat, sceneId)) {
				await endCombatIfPossible(activeCombat);
			}

			scheduleViewSync('cleanup:post');
		} catch (error) {
			console.error('[Nimble:CombatStateGuard] Combat state cleanup failed:', error);
		}
	}

	const scheduleSceneCleanup = createPostUpdateSchedulerPerKey(cleanupSceneCombatState);
	const scheduleViewSync = createPostUpdateScheduler(ensureViewedCombatForCurrentScene);

	// Narrow `Hooks.on` to avoid expensive Foundry hook overload resolution.
	const on = Hooks.on as (hook: string, fn: (...args: unknown[]) => void) => number;

	/**
	 * Token lifecycle: deleting the last token(s) should end combat.
	 */
	hookIds.push({
		hook: 'deleteToken',
		id: on('deleteToken', (tokenRaw: unknown) => {
			const token = tokenRaw as TokenRef;
			const sceneId = token.parent?.id;
			if (!sceneId) return;
			scheduleSceneCleanup(sceneId);
		}),
	});

	/**
	 * Combatant lifecycle: deleting the last combatant should also end combat.
	 */
	hookIds.push({
		hook: 'deleteCombatant',
		id: on('deleteCombatant', (combatantRaw: unknown) => {
			const combatant = combatantRaw as CombatantRef;
			const sceneId = combatant.sceneId;
			if (!sceneId) return;
			scheduleSceneCleanup(sceneId);
		}),
	});

	/**
	 * Combat lifecycle: keep `viewed` converged on the active combat for this scene, per-client.
	 */
	hookIds.push({
		hook: 'createCombat',
		id: on('createCombat', () => scheduleViewSync('createCombat')),
	});
	hookIds.push({
		hook: 'updateCombat',
		id: on('updateCombat', () => scheduleViewSync('updateCombat')),
	});
	hookIds.push({
		hook: 'deleteCombat',
		id: on('deleteCombat', () => scheduleViewSync('deleteCombat')),
	});
	hookIds.push({
		hook: 'canvasReady',
		id: on('canvasReady', () => scheduleViewSync('canvasReady')),
	});
}
