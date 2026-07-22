import { clearBankedDamageReduction } from '#utils/bankedDamageReduction.js';
import { isActiveGM } from '#utils/isActiveGM.js';

let registered = false;
const handledCombatIds = new Set<string>();

function getCombatIdentifier(combat: Combat): string | null {
	if (typeof combat.id !== 'string') return null;
	const trimmed = combat.id.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function clearBanksForCombatants(combat: Combat): void {
	for (const combatant of combat.combatants.contents) {
		const actor = combatant.actor;
		if (!actor) continue;
		void clearBankedDamageReduction(actor as Actor.Implementation);
	}
}

function didEncounterEndTransition(changes: Record<string, unknown>): boolean {
	if (!foundry.utils.hasProperty(changes, 'started')) return false;
	return foundry.utils.getProperty(changes, 'started') === false;
}

/**
 * A banked one-shot damage reduction is spent in reaction to a single attack;
 * a bank that was never consumed (the GM voided the hit, or forgot to apply)
 * must not survive the encounter. Clears every combatant's bank when a combat
 * ends, using the same two end-of-combat signals and dedup as
 * `dicePoolTriggers/encounterEndTrigger.ts`. Banks created outside combat are
 * untouched (no combat ever ends for them).
 *
 * Gated to the active GM so the ActiveEffect deletions run exactly once.
 */
export function registerBankedDamageReductionExpiryHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateCombat', (combat: Combat, changes: Record<string, unknown>) => {
		if (!isActiveGM()) return;
		if (!didEncounterEndTransition(changes)) return;
		if (combat.combatants.size === 0) return;
		const combatId = getCombatIdentifier(combat);
		if (combatId && handledCombatIds.has(combatId)) return;
		if (combatId) handledCombatIds.add(combatId);
		clearBanksForCombatants(combat);
	});

	Hooks.on('deleteCombat', (combat: Combat) => {
		if (!isActiveGM()) return;
		const combatId = getCombatIdentifier(combat);
		const alreadyHandled = combatId ? handledCombatIds.has(combatId) : false;
		if (!alreadyHandled) {
			clearBanksForCombatants(combat);
		}
		if (combatId) handledCombatIds.delete(combatId);
	});
}
