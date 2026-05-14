import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

/**
 * Fires the `onInitiativeRolled` recovery trigger when an actor rolls
 * initiative. Driven off `nimble.initiativeRolled`. Pools that opt into
 * recovery on this trigger (Commander Combat Dice: "When you roll Initiative,
 * gain STR Combat Dice") receive their recovery entry's effect.
 */
export function registerInitiativeTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// @ts-expect-error Custom hook
	Hooks.on('nimble.initiativeRolled', (payload: { actor?: unknown }) => {
		const actor = payload?.actor;
		if (!actor || typeof actor !== 'object') return;
		const typedActor = actor as Actor.Implementation;
		if (typedActor.type !== 'character') return;

		void applyRecoveryToActorIfEligible(typedActor as CharacterActorLike, 'onInitiativeRolled');
	});
}
