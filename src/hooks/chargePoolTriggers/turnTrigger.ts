import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

function charactersIn(combatant: Combatant.Implementation): CharacterActorLike[] {
	const combatants = (combatant.parent as Combat | null)?.combatants?.contents ?? [];
	const actors = new Set<CharacterActorLike>();
	for (const entry of combatants) {
		if (entry.type === 'character' && entry.actor) actors.add(entry.actor as CharacterActorLike);
	}
	return [...actors];
}

export function registerTurnTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// Both custom hooks are emitted by the combat document on the active GM's
	// client only (turn events fire there exactly once), so no further gating
	// is needed to keep recoveries from applying multiple times.
	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnStart', (combatant: Combatant.Implementation) => {
		for (const actor of charactersIn(combatant)) {
			void applyRecoveryToActorIfEligible(actor, 'onAnyTurnStart');
		}
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
