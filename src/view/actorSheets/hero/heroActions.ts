import { getActiveCombatForCurrentScene } from '#utils/combat/combatState.js';

const MAX_ACTIONS = 10;
const DEFAULT_ACTIONS = 3;

export function baseMaxActions(base: { max: number }): number {
	return base.max || DEFAULT_ACTIONS;
}

/** A turn has at most 10 actions, extra actions included. */
export function mayAddAction(base: { max: number }, additional: number): boolean {
	return baseMaxActions(base) + additional < MAX_ACTIONS;
}

export function combatantOf(
	actorId: string | null,
): { combat: Combat; combatant: Combatant } | null {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((entry) => entry.actorId === actorId);
	return combat && combatant ? { combat, combatant } : null;
}
