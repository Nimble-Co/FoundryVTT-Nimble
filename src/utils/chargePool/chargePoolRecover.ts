import {
	applyRecoveryTriggersToPools,
	areChargePoolMapsEqual,
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	isCharacterActor,
	persistChargePoolMap,
	toFiniteNonNegativeInteger,
} from './helpers.js';
import type { ChargeRestType, ManualAdjustMode } from './types.js';

async function applyRestRecovery(
	actor: Actor | null | undefined,
	restType: ChargeRestType,
): Promise<void> {
	if (!isCharacterActor(actor)) return;
	const trigger: 'safeRest' | 'fieldRest' = restType === 'safe' ? 'safeRest' : 'fieldRest';

	const currentPools = buildEffectiveChargePoolMap(actor);
	const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [trigger]);
	if (areChargePoolMapsEqual(currentPools, nextPools)) return;

	await persistChargePoolMap(actor, nextPools);
}

async function applyEncounterRecovery(
	actor: Actor | null | undefined,
	encounterTrigger: 'encounterStart' | 'encounterEnd',
): Promise<void> {
	if (!isCharacterActor(actor)) return;

	const currentPools = buildEffectiveChargePoolMap(actor);
	const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [encounterTrigger]);
	if (areChargePoolMapsEqual(currentPools, nextPools)) return;

	await persistChargePoolMap(actor, nextPools);
}

async function adjustPool(
	actor: Actor | null | undefined,
	poolId: string,
	mode: ManualAdjustMode,
	value: number,
): Promise<boolean> {
	if (!isCharacterActor(actor)) return false;
	if (typeof poolId !== 'string' || poolId.length < 1) return false;

	const currentPools = buildEffectiveChargePoolMap(actor);
	const pool = currentPools[poolId];
	if (!pool) return false;

	const normalizedValue = toFiniteNonNegativeInteger(value);
	if (mode === 'refresh') {
		pool.current = pool.max;
	} else if (mode === 'set') {
		pool.current = clampCurrentToMax(normalizedValue, pool.max);
	} else {
		pool.current = clampCurrentToMax(pool.current + normalizedValue, pool.max);
	}

	await persistChargePoolMap(actor, currentPools);
	return true;
}

export { applyRestRecovery, applyEncounterRecovery, adjustPool };
