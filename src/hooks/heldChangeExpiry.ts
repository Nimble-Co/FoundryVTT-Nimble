import { expireHeldChanges } from '#utils/heldChange/heldChange.js';
import { isActiveGM } from '#utils/isActiveGM.js';

type Holders = Parameters<typeof expireHeldChanges>[0];

function holdersOf(combat: Combat): Holders {
	const actors = new Set<unknown>();
	for (const combatant of combat.combatants.contents) actors.add(combatant.actor);
	for (const token of canvas?.scene?.tokens ?? []) actors.add(token.actor);
	return actors as Holders;
}

/** The GM removes the icon of a Held Change when its turn, round or combat ends. */
export function registerHeldChangeExpiryHooks(): void {
	Hooks.on('updateCombat', (combat: Combat, changes: Record<string, unknown>) => {
		if (!isActiveGM()) return;
		if (!('round' in changes || 'turn' in changes || 'started' in changes)) return;
		void expireHeldChanges(holdersOf(combat));
	});
	Hooks.on('deleteCombat', (combat: Combat) => {
		if (!isActiveGM()) return;
		void expireHeldChanges(holdersOf(combat));
	});
}
