import { isCombatStarted } from './isCombatStarted.js';

/** The actor's combatant in the started combat, or null outside combat. */
export function findActorCombatant(
	actor: Actor | null | undefined,
): { combat: Combat; combatant: Combatant } | null {
	const combat = game.combat ?? null;
	if (!actor || !combat || !isCombatStarted(combat)) return null;
	const combatant = combat.combatants.find(
		(candidate) => candidate.actor === actor || candidate.actor?.uuid === actor.uuid,
	);
	return combatant ? { combat, combatant } : null;
}
