import { applyRefillToActorIfEligible } from '#utils/dicePool/dicePoolRefill.js';
import type { CharacterActorLike } from '#utils/dicePool/types.js';

let registered = false;

/**
 * Fires the `onTurnStart` / `onTurnEnd` dice-pool refill triggers for the
 * combatant whose turn is starting or ending. Driven off the
 * `nimbleCombatTurnStart` / `nimbleCombatTurnEnd` custom hooks, which the
 * combat document emits exactly once per turn boundary on the active GM's
 * client. Pools opt in via refill entries with these triggers, optionally
 * gated by an entry-level predicate.
 */
export function registerDicePoolTurnTriggerHooks(): void {
	if (registered) return;
	registered = true;

	const makeHandler = (trigger: 'onTurnStart' | 'onTurnEnd') => {
		return (combatant: Combatant.Implementation) => {
			if (combatant.type !== 'character') return;
			if (!combatant.actor) return;
			void applyRefillToActorIfEligible(combatant.actor as CharacterActorLike, trigger);
		};
	};

	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnStart', makeHandler('onTurnStart'));
	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnEnd', makeHandler('onTurnEnd'));
}
