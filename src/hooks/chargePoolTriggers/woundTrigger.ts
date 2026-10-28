import { woundsGained } from '#utils/actor/actorHpChangePaths.js';
import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

export function registerWoundTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on(
		'updateActor',
		(actor: Actor.Implementation, _changes: unknown, options: unknown, userId: string) => {
			if (actor.type !== 'character') return;
			// The user who made the update can write the actor, so only that client refills.
			if (userId !== game.user?.id) return;
			if (woundsGained(actor, options) <= 0) return;

			void applyRecoveryToActorIfEligible(actor as CharacterActorLike, 'onWound');
		},
	);
}
