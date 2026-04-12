import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

let registered = false;

export function registerKillTriggerHooks(): void {
	if (registered) return;
	registered = true;

	const hookHandler = (attacker: Actor.Implementation, killedActor: Actor.Implementation) => {
		if (attacker.type !== 'character') return;
		void applyRecoveryToActorIfEligible(attacker as CharacterActorLike, 'onKill', killedActor);
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(
		Hooks.on as (
			event: string,
			fn: (attacker: Actor.Implementation, killedActor: Actor.Implementation) => void,
		) => any
	)('nimbleKillApplied', hookHandler);
}
