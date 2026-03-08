import {
	getActorHpMaxValue,
	getActorHpValue,
	getActorLastStandThreshold,
} from './actorResources.js';

export type ActorHealthState = 'normal' | 'bloodied' | 'lastStand' | 'unknown';

export function getActorHealthState(
	actor: Actor.Implementation | null | undefined,
): ActorHealthState {
	if (!actor) return 'unknown';

	const hpValue = getActorHpValue(actor);
	const hpMax = getActorHpMaxValue(actor);
	if (hpValue === null || hpMax === null) return 'unknown';

	if (actor.type === 'soloMonster') {
		const lastStandThreshold = getActorLastStandThreshold(actor);
		if (lastStandThreshold !== null && hpValue <= lastStandThreshold) {
			return 'lastStand';
		}
	}

	return hpValue <= hpMax / 2 ? 'bloodied' : 'normal';
}

export function isActorBloodied(actor: Actor.Implementation | null | undefined): boolean {
	return getActorHealthState(actor) === 'bloodied';
}

export function isActorInLastStand(actor: Actor.Implementation | null | undefined): boolean {
	return getActorHealthState(actor) === 'lastStand';
}
