import { emitForCharacter } from './chargePoolHooks.js';
import {
	applyRecoveryTriggersToPools,
	areChargePoolMapsEqual,
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	isCharacterActor,
	persistChargePoolMap,
	toFiniteNonNegativeInteger,
} from './helpers.js';
import type { CharacterActorLike, ChargeRestType, ManualAdjustMode } from './types.js';

type CombatTrigger = 'encounterStart' | 'encounterEnd';
type CombatEventTrigger = 'onTurnStart' | 'onTurnEnd' | 'onWound' | 'onKill' | 'onBloodied';
type TriggerType = CombatTrigger | CombatEventTrigger;

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

	const recoveryEntries: Array<{
		poolId: string;
		poolLabel: string;
		previousValue: number;
		newValue: number;
		recoveredAmount: number;
	}> = [];

	for (const [poolId, nextPool] of Object.entries(nextPools)) {
		const prePool = currentPools[poolId];
		if (!prePool || prePool.current === nextPool.current) continue;
		recoveryEntries.push({
			poolId,
			poolLabel: nextPool.label,
			previousValue: prePool.current,
			newValue: nextPool.current,
			recoveredAmount: nextPool.current - prePool.current,
		});
	}

	if (recoveryEntries.length > 0) {
		emitForCharacter(actor, 'recovered', {
			actor: actor as CharacterActorLike,
			trigger,
			recovery: recoveryEntries,
		});

		for (const entry of recoveryEntries) {
			emitForCharacter(actor, 'changed', {
				actor: actor as CharacterActorLike,
				poolId: entry.poolId,
				poolLabel: entry.poolLabel,
				previousValue: entry.previousValue,
				newValue: entry.newValue,
				maxValue: nextPools[entry.poolId]?.max ?? entry.newValue,
				reason: 'recovery',
				trigger,
			});
		}
	}
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

	const recoveryEntries: Array<{
		poolId: string;
		poolLabel: string;
		previousValue: number;
		newValue: number;
		recoveredAmount: number;
	}> = [];

	for (const [poolId, nextPool] of Object.entries(nextPools)) {
		const prePool = currentPools[poolId];
		if (!prePool || prePool.current === nextPool.current) continue;
		recoveryEntries.push({
			poolId,
			poolLabel: nextPool.label,
			previousValue: prePool.current,
			newValue: nextPool.current,
			recoveredAmount: nextPool.current - prePool.current,
		});
	}

	if (recoveryEntries.length > 0) {
		emitForCharacter(actor, 'recovered', {
			actor: actor as CharacterActorLike,
			trigger: encounterTrigger,
			recovery: recoveryEntries,
		});

		for (const entry of recoveryEntries) {
			emitForCharacter(actor, 'changed', {
				actor: actor as CharacterActorLike,
				poolId: entry.poolId,
				poolLabel: entry.poolLabel,
				previousValue: entry.previousValue,
				newValue: entry.newValue,
				maxValue: nextPools[entry.poolId]?.max ?? entry.newValue,
				reason: 'recovery',
				trigger: encounterTrigger,
			});
		}
	}
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

	const previousValue = pool.current;
	const normalizedValue = toFiniteNonNegativeInteger(value);
	if (mode === 'refresh') {
		pool.current = pool.max;
	} else if (mode === 'set') {
		pool.current = clampCurrentToMax(normalizedValue, pool.max);
	} else {
		pool.current = clampCurrentToMax(pool.current + normalizedValue, pool.max);
	}

	const newValue = pool.current;
	await persistChargePoolMap(actor, currentPools);

	emitForCharacter(actor, 'recovered', {
		actor: actor as CharacterActorLike,
		trigger: 'manual',
		recovery: [
			{
				poolId,
				poolLabel: pool.label,
				previousValue,
				newValue,
				recoveredAmount: newValue - previousValue,
			},
		],
	});

	emitForCharacter(actor, 'changed', {
		actor: actor as CharacterActorLike,
		poolId,
		poolLabel: pool.label,
		previousValue,
		newValue,
		maxValue: pool.max,
		reason: 'adjust',
		trigger: 'manual',
	});

	return true;
}

async function applyRecoveryToActorIfEligible(
	actor: Actor | null | undefined,
	trigger: TriggerType,
	_killTargetActor?: Actor.Implementation,
): Promise<void> {
	if (!isCharacterActor(actor)) return;

	const currentPools = buildEffectiveChargePoolMap(actor);
	const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [trigger]);
	if (areChargePoolMapsEqual(currentPools, nextPools)) return;

	await persistChargePoolMap(actor, nextPools);

	const recoveryEntries: Array<{
		poolId: string;
		poolLabel: string;
		previousValue: number;
		newValue: number;
		recoveredAmount: number;
	}> = [];

	for (const [poolId, nextPool] of Object.entries(nextPools)) {
		const prePool = currentPools[poolId];
		if (!prePool || prePool.current === nextPool.current) continue;
		recoveryEntries.push({
			poolId,
			poolLabel: nextPool.label,
			previousValue: prePool.current,
			newValue: nextPool.current,
			recoveredAmount: nextPool.current - prePool.current,
		});
	}

	if (recoveryEntries.length > 0) {
		emitForCharacter(actor, 'recovered', {
			actor: actor as CharacterActorLike,
			trigger,
			recovery: recoveryEntries,
		});

		for (const entry of recoveryEntries) {
			emitForCharacter(actor, 'changed', {
				actor: actor as CharacterActorLike,
				poolId: entry.poolId,
				poolLabel: entry.poolLabel,
				previousValue: entry.previousValue,
				newValue: entry.newValue,
				maxValue: nextPools[entry.poolId]?.max ?? entry.newValue,
				reason: 'recovery',
				trigger,
			});
		}
	}
}

export { applyRestRecovery, applyEncounterRecovery, adjustPool, applyRecoveryToActorIfEligible };
