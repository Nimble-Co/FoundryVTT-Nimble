import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

function charactersIn(combatant: Combatant.Implementation): CharacterActorLike[] {
	const actors = new Set<CharacterActorLike>();
	for (const entry of combatant.parent?.combatants.contents ?? []) {
		if (entry.type === 'character' && entry.actor) actors.add(entry.actor as CharacterActorLike);
	}
	return [...actors];
}

/** One actor's refills run in turn, because a pool write sends every pool of the item. */
async function recoverAtTurnStart(combatant: Combatant.Implementation): Promise<void> {
	const own =
		combatant.type === 'character' ? (combatant.actor as CharacterActorLike | null) : null;
	const actors = charactersIn(combatant);
	if (own && !actors.includes(own)) actors.push(own);
	await Promise.all(
		actors.map(async (actor) => {
			await applyRecoveryToActorIfEligible(actor, 'onAnyTurnStart');
			if (actor === own) await applyRecoveryToActorIfEligible(actor, 'onTurnStart');
		}),
	);
}

export function registerTurnTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// Both custom hooks are emitted by the combat document on the active GM's
	// client only (turn events fire there exactly once), so no further gating
	// is needed to keep recoveries from applying multiple times.
	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnStart', (combatant: Combatant.Implementation) => {
		void recoverAtTurnStart(combatant);
	});

	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnEnd', (combatant: Combatant.Implementation) => {
		if (combatant.type !== 'character') return;
		if (!combatant.actor) return;
		void applyRecoveryToActorIfEligible(combatant.actor as CharacterActorLike, 'onTurnEnd');
	});
}
