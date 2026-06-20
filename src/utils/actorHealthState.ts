import { STATUS_EFFECT_IDS } from '../config/registerConditionsConfig.js';
import { getActorHpMaxValue, getActorHpValue } from './actorResources.js';

export type ActorHealthState = 'normal' | 'bloodied' | 'lastStand' | 'unknown';

/**
 * Maximum number of actions a combatant may take while suffering the Dying condition.
 * Per the Nimble rules, "while Dying, actions are limited to 1".
 */
export const DYING_MAX_ACTIONS = 1;

export function hasLastStandStatus(actor: Actor.Implementation | null | undefined): boolean {
	if (!actor) return false;
	return actor.statuses instanceof Set && actor.statuses.has(STATUS_EFFECT_IDS.lastStand);
}

export function isActorDying(actor: Actor.Implementation | null | undefined): boolean {
	if (!actor) return false;
	return actor.statuses instanceof Set && actor.statuses.has(STATUS_EFFECT_IDS.dying);
}

/**
 * Single-state classification used for UI/tooltip purposes. Last Stand takes priority
 * over Bloodied when both are true, since it represents the more critical state.
 * For independent toggling of statuses, use {@link isActorAtOrBelowHalfHp} directly.
 */
export function getActorHealthState(
	actor: Actor.Implementation | null | undefined,
): ActorHealthState {
	if (!actor) return 'unknown';

	const hpValue = getActorHpValue(actor);
	const hpMax = getActorHpMaxValue(actor);
	if (hpValue === null || hpMax === null) return 'unknown';

	if (hasLastStandStatus(actor) && hpValue > 0) {
		return 'lastStand';
	}

	if (hpValue <= 0) return 'unknown';
	return hpValue <= hpMax / 2 ? 'bloodied' : 'normal';
}

export function isActorAtOrBelowHalfHp(actor: Actor.Implementation | null | undefined): boolean {
	if (!actor) return false;
	const hpValue = getActorHpValue(actor);
	const hpMax = getActorHpMaxValue(actor);
	if (hpValue === null || hpMax === null) return false;
	return hpValue > 0 && hpValue <= hpMax / 2;
}

export function isActorBloodied(actor: Actor.Implementation | null | undefined): boolean {
	return getActorHealthState(actor) === 'bloodied';
}

export function isActorInLastStand(actor: Actor.Implementation | null | undefined): boolean {
	return getActorHealthState(actor) === 'lastStand';
}
