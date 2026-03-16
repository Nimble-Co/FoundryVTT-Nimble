import { syncCombatTurns } from './combatTurnSync.js';

export const COMBAT_STATE_HOOK_NAMES = [
	'combatStart',
	'combatTurn',
	'combatRound',
	'createCombat',
	'updateCombat',
	'deleteCombat',
	'createCombatant',
	'updateCombatant',
	'deleteCombatant',
	'canvasInit',
	'canvasReady',
] as const;

type CombatStateHookName = (typeof COMBAT_STATE_HOOK_NAMES)[number];

export function registerCombatStateHooks(listener: () => void): () => void {
	const hooksApi = Hooks as unknown as {
		on: (hook: CombatStateHookName, listener: () => void) => number;
		off: (hook: CombatStateHookName, id: number) => void;
	};

	const hookIds = COMBAT_STATE_HOOK_NAMES.map((hookName) => ({
		hookId: hooksApi.on(hookName, listener),
		hookName,
	}));

	return () => {
		for (const { hookName, hookId } of hookIds) {
			hooksApi.off(hookName, hookId);
		}
	};
}

export function getActiveCombatForCurrentScene(): Combat | null {
	const sceneId = canvas?.scene?.id;
	if (!sceneId) return null;

	const activeCombat = game.combat;
	if (activeCombat?.active && activeCombat.scene?.id === sceneId) {
		syncCombatTurns(activeCombat);
		return activeCombat;
	}

	const activeByScene = game.combats?.contents?.find(
		(combat) => combat?.active && combat.scene?.id === sceneId,
	);
	if (activeByScene) {
		syncCombatTurns(activeByScene);
		return activeByScene;
	}

	const viewedCombat = game.combats?.viewed ?? null;
	if (viewedCombat?.active && viewedCombat.scene?.id === sceneId) {
		syncCombatTurns(viewedCombat);
		return viewedCombat;
	}

	return null;
}
