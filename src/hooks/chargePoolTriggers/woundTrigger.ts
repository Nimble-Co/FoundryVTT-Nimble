import { woundsGained } from '#utils/actor/actorHpChangePaths.js';
import { actorRules } from '#utils/actor/actorRules.js';
import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

interface WoundMove {
	type?: string;
	trigger?: string;
	offerOnWound?: () => Promise<void>;
}

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
			const gained = woundsGained(actor, options);
			if (gained <= 0) return;

			void (async () => {
				for (let wound = 0; wound < gained; wound++) {
					await applyRecoveryToActorIfEligible(actor as CharacterActorLike, 'onWound');
					for (const rule of actorRules<WoundMove>(actor as unknown as { rules?: unknown })) {
						if (rule?.type !== 'freeMove' || rule.trigger !== 'onWound') continue;
						await rule.offerOnWound?.();
					}
				}
			})();
		},
	);
}
