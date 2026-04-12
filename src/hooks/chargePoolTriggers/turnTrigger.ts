import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

export function registerTurnTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on(
		'combatTurn',
		(
			combat: Combat,
			_updateData: { round: number; turn: number },
			_updateOptions: { advanceTime: number; direction: number },
		) => {
			const combatant = combat.combatant;
			if (!combatant || combatant.type !== 'character') return;
			if (combatant.actor) {
				// @ts-expect-error Custom hook
				Hooks.call('nimbleCombatTurnStart', combatant);
			}
		},
	);

	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnEnd', (combatant: Combatant.Implementation) => {
		if (combatant.type !== 'character') return;
		if (!combatant.actor) return;
		void applyRecoveryToActorIfEligible(combatant.actor as CharacterActorLike, 'onTurnEnd');
	});
}
