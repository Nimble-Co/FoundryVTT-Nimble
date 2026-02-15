/**
 * Combat state guards
 *
 * Foundry can end up in a partially-active combat state if all tokens are removed from a scene
 * without triggering the normal combat end lifecycle. In that case token indicators can still
 * refresh while the combat tracker UI (which depends on `game.combats.viewed`) fails to render.
 *
 * This hook set repairs that state by:
 * - Re-syncing the client's viewed combat to the active combat for the current canvas scene.
 *
 * Note: This intentionally does not end combat automatically. Combat should only end through the
 * explicit "End Combat" UI action.
 */
let didRegisterCombatStateGuards = false;
type HookRegistration = { hook: Hooks.HookName; id: number };
let hookIds: HookRegistration[] = [];

type ViewCombatFn = (combat: Combat | null, options?: { render?: boolean }) => void;

function hasViewCombat(value: object): value is { viewCombat: ViewCombatFn } {
	return (
		'viewCombat' in value &&
		typeof (value as { viewCombat?: ViewCombatFn }).viewCombat === 'function'
	);
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

function isTokenBackedCombatant(combatant: Combatant, sceneId: string): boolean {
	if (combatant.sceneId !== sceneId) return false;

	return (combatant.tokenId != null && combatant.tokenId !== '') || combatant.token?.id != null;
}

function isCombatViewableForScene(combat: Combat, sceneId: string): boolean {
	return combat.combatants.contents.some((c) => isTokenBackedCombatant(c, sceneId));
}

function getCombatsContents(): Combat[] {
	return game.combats.contents;
}

export function unregisterCombatStateGuards() {
	for (const { hook, id } of hookIds) {
		Hooks.off(hook, id);
	}
	hookIds = [];
	didRegisterCombatStateGuards = false;
}

export default function combatStateGuards() {
	// In dev/hot-reload scenarios `ready` can run more than once; make registration idempotent.
	if (didRegisterCombatStateGuards) return;
	didRegisterCombatStateGuards = true;

	function getActiveCombatForScene(sceneId: string): Combat | null {
		// Prefer the canonical active combat reference when possible.
		const active = game.combat;
		if (active?.active && active.scene?.id === sceneId) return active;

		// Look through the combats collection for an active combat in this scene.
		const byScene = getCombatsContents().find((c) => c.active && c.scene?.id === sceneId);
		if (byScene) return byScene;

		// Fallback: a viewed combat that is active for this scene.
		const viewed = game.combats.viewed ?? null;
		if (viewed?.active && viewed.scene?.id === sceneId) return viewed;

		return null;
	}

	function ensureViewedCombatForCurrentScene(): void {
		if (!canvas?.ready || !canvas.scene) return;

		const sceneId = canvas.scene.id;
		const activeCombat = getActiveCombatForScene(sceneId);

		const combats = game.combats;
		if (!hasViewCombat(combats)) return;

		const viewed = combats.viewed ?? null;

		const viewedIsValidForScene =
			viewed !== null && viewed.scene?.id === sceneId && isCombatViewableForScene(viewed, sceneId);

		// Active combat should always be the viewed combat for this scene,
		// even when it temporarily has zero combatants.
		if (activeCombat && viewed?.id !== activeCombat.id) {
			combats.viewCombat(activeCombat, { render: true });
			return;
		}

		// No active combat, but we're viewing something no longer viewable.
		if (!activeCombat && viewed?.scene?.id === sceneId && !viewedIsValidForScene) {
			combats.viewCombat(null, { render: true });
		}
	}

	const scheduleViewSync = createPostUpdateScheduler(ensureViewedCombatForCurrentScene);

	/**
	 * Combat lifecycle: keep `viewed` converged on the active combat for this scene, per-client.
	 */
	hookIds.push({
		hook: 'createCombat',
		id: Hooks.on('createCombat', () => scheduleViewSync('createCombat')),
	});
	hookIds.push({
		hook: 'updateCombat',
		id: Hooks.on('updateCombat', () => scheduleViewSync('updateCombat')),
	});
	hookIds.push({
		hook: 'deleteCombat',
		id: Hooks.on('deleteCombat', () => scheduleViewSync('deleteCombat')),
	});
	hookIds.push({
		hook: 'canvasReady',
		id: Hooks.on('canvasReady', () => scheduleViewSync('canvasReady')),
	});
}
