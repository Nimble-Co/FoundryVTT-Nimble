import {
	applyRecoveryTriggersToPools,
	areChargePoolMapsEqual,
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	getApplicableUsageTriggers,
	getChargeConsumers,
	isCharacterActor,
	persistChargePoolMap,
	resolveRecoveryTrigger,
	toFiniteNonNegativeInteger,
} from './helpers.js';
import type {
	ChargeConsumptionDetail,
	ChargeContext,
	ChargeValidationResult,
	RuleBackedItem,
} from './types.js';

function validateItemChargeConsumption(item: Item | null | undefined): ChargeValidationResult {
	if (!item) return { ok: true };
	const ruleBackedItem = item as RuleBackedItem;
	const actor = item.actor;
	if (!isCharacterActor(actor)) return { ok: true };

	const pools = buildEffectiveChargePoolMap(actor);
	const consumers = getChargeConsumers(actor, ruleBackedItem);
	for (const consumer of consumers) {
		const pool = pools[consumer.poolId];
		if (!pool) {
			return {
				ok: false,
				failure: {
					code: 'poolMissing',
					poolIdentifier: consumer.poolIdentifier,
					poolLabel: consumer.poolIdentifier,
					required: consumer.cost,
					available: 0,
				},
			};
		}

		const available = toFiniteNonNegativeInteger(pool.current);
		if (available < consumer.cost) {
			return {
				ok: false,
				failure: {
					code: 'insufficientCharges',
					poolIdentifier: consumer.poolIdentifier,
					poolLabel: pool.label,
					required: consumer.cost,
					available,
				},
			};
		}
	}

	return { ok: true };
}

async function consumeOnResolvedItemUse(
	item: Item | null | undefined,
	context: ChargeContext = {},
): Promise<ChargeValidationResult> {
	if (!item) return { ok: true };
	const ruleBackedItem = item as RuleBackedItem;
	const actor = item.actor;
	if (!isCharacterActor(actor)) return { ok: true };

	const currentPools = buildEffectiveChargePoolMap(actor);
	const consumers = getChargeConsumers(actor, ruleBackedItem);

	const consumption: ChargeConsumptionDetail[] = [];
	const consumptionByPoolId = new Map<string, ChargeConsumptionDetail>();
	const consumedPoolIds = new Set<string>();
	const nextPools = foundry.utils.deepClone(currentPools) as typeof currentPools;
	const triggers = getApplicableUsageTriggers(context);

	for (const consumer of consumers) {
		const pool = nextPools[consumer.poolId];
		if (!pool) {
			return {
				ok: false,
				failure: {
					code: 'poolMissing',
					poolIdentifier: consumer.poolIdentifier,
					poolLabel: consumer.poolIdentifier,
					required: consumer.cost,
					available: 0,
				},
			};
		}

		if (pool.current < consumer.cost) {
			return {
				ok: false,
				failure: {
					code: 'insufficientCharges',
					poolIdentifier: consumer.poolIdentifier,
					poolLabel: pool.label,
					required: consumer.cost,
					available: pool.current,
				},
			};
		}

		pool.current = clampCurrentToMax(pool.current - consumer.cost, pool.max);
		consumedPoolIds.add(consumer.poolId);
	}

	const postRecoveryPools = applyRecoveryTriggersToPools(actor, nextPools, triggers);

	for (const poolId of consumedPoolIds) {
		const preConsumptionPool = currentPools[poolId];
		const postConsumptionPool = nextPools[poolId];
		const postRecoveryPool = postRecoveryPools[poolId];

		if (!preConsumptionPool || !postConsumptionPool || !postRecoveryPool) continue;

		const previousValue = preConsumptionPool.current;
		const currentValue = postConsumptionPool.current;
		const change = currentValue - previousValue;

		consumptionByPoolId.set(poolId, {
			poolLabel: postRecoveryPool.label,
			previousValue,
			currentValue,
			maxValue: postRecoveryPool.max,
			change,
		});
	}

	for (const [poolId, postRecoveryPool] of Object.entries(postRecoveryPools)) {
		const postConsumptionPool = nextPools[poolId];
		if (!postConsumptionPool) continue;
		if (postConsumptionPool.current === postRecoveryPool.current) continue;

		const recovery: NonNullable<ChargeConsumptionDetail['recovery']> = {
			trigger: resolveRecoveryTrigger(postRecoveryPool, triggers),
			previousValue: postConsumptionPool.current,
			newValue: postRecoveryPool.current,
		};

		const existingEntry = consumptionByPoolId.get(poolId);
		if (existingEntry) {
			existingEntry.recovery = recovery;
			continue;
		}

		const preConsumptionPool = currentPools[poolId];
		const previousValue = preConsumptionPool?.current ?? postConsumptionPool.current;
		const currentValue = postConsumptionPool.current;
		const change = currentValue - previousValue;

		consumptionByPoolId.set(poolId, {
			poolLabel: postRecoveryPool.label,
			previousValue,
			currentValue,
			maxValue: postRecoveryPool.max,
			change,
			recovery,
		});
	}

	consumption.push(...consumptionByPoolId.values());

	if (!areChargePoolMapsEqual(currentPools, postRecoveryPools)) {
		await persistChargePoolMap(actor, postRecoveryPools);
	}

	return { ok: true, consumption };
}

export { validateItemChargeConsumption, consumeOnResolvedItemUse };
