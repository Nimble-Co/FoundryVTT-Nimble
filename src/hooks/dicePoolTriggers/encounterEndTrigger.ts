import { applyEncounterRefill } from '#utils/dicePool/dicePoolRefill.js';

let registered = false;
const handledCombatIds = new Set<string>();

function getCombatIdentifier(combat: Combat): string | null {
	if (typeof combat.id !== 'string') return null;
	const trimmed = combat.id.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function applyEncounterEndToCombatants(combat: Combat): void {
	for (const combatant of combat.combatants.contents) {
		const actor = combatant.actor;
		if (!actor || actor.type !== 'character') continue;
		void applyEncounterRefill(actor as Actor.Implementation, 'encounterEnd');
	}
}

function didEncounterEndTransition(changes: Record<string, unknown>): boolean {
	if (!foundry.utils.hasProperty(changes, 'started')) return false;
	return foundry.utils.getProperty(changes, 'started') === false;
}

/**
 * Fires the `encounterEnd` refill trigger for every character actor in a
 * combat that just ended. Wired off two signals because Foundry doesn't have
 * one clean "combat ended" hook:
 *
 * - `updateCombat` with `started: false` — combat ended without being deleted.
 * - `deleteCombat` — combat tracker was removed entirely.
 *
 * Both can fire for the same combat in close succession; `handledCombatIds`
 * dedupes so each end-of-combat triggers the refill exactly once.
 *
 * Pools that opt into `encounterEnd` (Oathsworn Judgment Dice: dice expended
 * at end of encounter) receive their refill entry's effect. Pools that don't
 * opt in are untouched.
 */
export function registerEncounterEndTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateCombat', (combat: Combat, changes: Record<string, unknown>) => {
		if (!didEncounterEndTransition(changes)) return;
		if (combat.combatants.size === 0) return;
		const combatId = getCombatIdentifier(combat);
		if (combatId && handledCombatIds.has(combatId)) return;
		if (combatId) handledCombatIds.add(combatId);
		applyEncounterEndToCombatants(combat);
	});

	Hooks.on('deleteCombat', (combat: Combat) => {
		const combatId = getCombatIdentifier(combat);
		const alreadyHandled = combatId ? handledCombatIds.has(combatId) : false;
		if (!alreadyHandled) {
			applyEncounterEndToCombatants(combat);
		}
		if (combatId) handledCombatIds.delete(combatId);
	});
}
