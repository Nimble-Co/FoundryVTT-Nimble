import { applyRefillToActorIfEligible } from '#utils/dicePool/dicePoolRefill.js';
import type { CharacterActorLike } from '#utils/dicePool/types.js';

let registered = false;

/**
 * Fires the `onAttacked` refill trigger for every character actor that takes
 * incoming damage. Driven off `nimble.damageApplied`, which fires once per
 * target when damage actually applies. Pools that opt into refilling on this
 * trigger (Oathsworn Judgment Dice: "Whenever an enemy attacks you, if you
 * have no Judgment Dice, roll your Judgment dice (2d6)") receive their refill
 * entry's effect; pools that don't opt in are untouched.
 */
export function registerAttackedTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// @ts-expect-error nimble.damageApplied is a custom Nimble hook not in
	// Foundry's typed Hooks union; emitted by the damage application pipeline
	// once per affected target, consumed here to drive onAttacked refill.
	Hooks.on('nimble.damageApplied', (payload: { targetActor?: unknown }) => {
		const target = payload?.targetActor;
		if (!target || typeof target !== 'object') return;
		const actor = target as Actor.Implementation;
		if (actor.type !== 'character') return;

		void applyRefillToActorIfEligible(actor as CharacterActorLike, 'onAttacked');
	});
}
