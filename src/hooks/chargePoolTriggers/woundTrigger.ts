import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

export function registerWoundTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		if (actor.type !== 'character') return;

		const woundsPath = 'system.attributes.wounds.value';
		if (!foundry.utils.hasProperty(changes, woundsPath)) return;

		const previousWounds = foundry.utils.getProperty(actor, woundsPath) as number | undefined;
		const newWounds = (changes as Record<string, unknown>)[woundsPath] as number | undefined;

		if (typeof previousWounds !== 'number' || typeof newWounds !== 'number') return;
		if (newWounds <= previousWounds) return;

		void applyRecoveryToActorIfEligible(actor as CharacterActorLike, 'onWound');
	});
}
