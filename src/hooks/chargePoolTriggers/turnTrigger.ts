import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

export function registerTurnTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// Both custom hooks are emitted by the combat document on the active GM's
	// client only (turn events fire there exactly once), so no further gating
	// is needed to keep recoveries from applying multiple times.
	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnStart', (combatant: Combatant.Implementation) => {
		if (combatant.type !== 'character') return;
		if (!combatant.actor) return;
		void applyRecoveryToActorIfEligible(combatant.actor as CharacterActorLike, 'onTurnStart');
	});

	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnEnd', (combatant: Combatant.Implementation) => {
		if (combatant.type !== 'character') return;
		if (!combatant.actor) return;
		void applyRecoveryToActorIfEligible(combatant.actor as CharacterActorLike, 'onTurnEnd');
	});
}
