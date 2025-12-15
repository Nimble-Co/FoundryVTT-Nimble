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
type CombatantRef = { sceneId: string; token: object | null };
type CombatRef = {
	id: string;
	active: boolean;
	scene?: SceneRef | null;
	combatants: { contents: CombatantRef[]; size: number };
	delete: () => Promise<void>;
};

type CombatViewApi = {
	viewed?: CombatRef | null;
	viewCombat?: (combat: CombatRef | null, options?: { render?: boolean }) => void;
};

/**
 * Create a "coalescing" scheduler that runs the handler **once per key** on the next tick.
 *
 * Why this exists:
 * - Foundry often fires multiple related hooks in quick succession (e.g. deleting many tokens).
 * - We don't want to run cleanup N times; we want to run it once after the batch settles.
 *
 * Implementation detail:
 * - Uses `setTimeout(..., 0)` (macrotask) so embedded collection updates have landed.
 */
function createOncePerTickPerKey<T>(handler: (value: T) => void | Promise<void>) {
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
 * Create a "coalescing" scheduler that runs the handler **at most once** on the next tick.
 *
 * This is effectively a debouncer used to collapse bursts like:
 * `updateCombat` → `updateCombatant` → `renderSceneNavigation` → `canvasReady`
 * into a single `ensureViewedCombatForCurrentScene()` pass.
 */
function createOncePerTick(handler: () => void | Promise<void>) {
	let scheduled = false;
	return () => {
		if (scheduled) return;
		scheduled = true;

		setTimeout(() => {
			scheduled = false;
			void handler();
		}, 0);
	};
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

		// Fallback: if the viewed combat is active for this scene, treat it as active.
		const viewed = (game.combats as { viewed?: CombatRef | null }).viewed ?? null;
		if (viewed?.active && viewed.scene?.id === sceneId) return viewed;

		return null;
	}

	function hasAnyTokenBackedCombatantsInScene(combat: CombatRef, sceneId: string): boolean {
		return combat.combatants.contents.some((combatant) => {
			if (combatant.sceneId !== sceneId) return false;
			// Combatants can remain after token deletion; those become token-less and should not
			// keep combat alive.
			return combatant.token !== null;
		});
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
			activeCombat !== null && hasAnyTokenBackedCombatantsInScene(activeCombat, sceneId);

		const combats = game.combats as CombatViewApi;
		const viewed = combats.viewed ?? null;

		const viewedIsValidForScene =
			viewed !== null && viewed.scene?.id === sceneId && viewed.combatants.size > 0;

		// If there is an active combat for the current scene but it is not viewable (no token-backed
		// combatants), do not force it as viewed. Clear the view instead so clients converge and the
		// tracker correctly hides.
		if (activeCombat && !activeCombatIsViewable) {
			if (viewed?.scene?.id === sceneId) combats.viewCombat?.(null, { render: true });
			return;
		}

		// activeCombat is guaranteed non-null if activeCombatIsViewable is true
		if (activeCombatIsViewable && (!viewedIsValidForScene || viewed?.id !== activeCombat!.id)) {
			combats.viewCombat?.(activeCombat, { render: true });
			return;
		}

		// If there is no active combat for the current scene but we're viewing an empty combat for
		// this scene, clear the view so clients converge on "no combat to show".
		if (!activeCombat && viewed?.scene?.id === sceneId && viewed.combatants.size === 0) {
			combats.viewCombat?.(null, { render: true });
		}
	}

	async function cleanupSceneCombatState(sceneId: string): Promise<void> {
		try {
			const activeCombat = getActiveCombatForScene(sceneId);
			if (!activeCombat) {
				scheduleViewSync();
				return;
			}

			// If combat is active but no combatants remain (or all remaining combatants have no token),
			// end combat to avoid leaving a partially-active combat state.
			const hasValid = hasAnyTokenBackedCombatantsInScene(activeCombat, sceneId);
			if (!hasValid) {
				await endCombatIfPossible(activeCombat);
			}

			scheduleViewSync();
		} catch (error) {
			console.error('[Nimble:CombatStateGuard] Combat state cleanup failed:', error);
		}
	}

	const scheduleSceneCleanup = createOncePerTickPerKey(cleanupSceneCombatState);
	const scheduleViewSync = createOncePerTick(ensureViewedCombatForCurrentScene);

	// Narrow `Hooks.on` to avoid expensive Foundry hook overload resolution.
	const on = Hooks.on as (hook: string, fn: (...args: object[]) => void) => number;

	/**
	 * Token lifecycle: deleting the last token(s) should end combat.
	 */
	hookIds.push({
		hook: 'deleteToken',
		id: on('deleteToken', (token: TokenRef) => {
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
		id: on('deleteCombatant', (combatant: CombatantRef) => {
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
