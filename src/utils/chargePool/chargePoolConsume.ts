import { emitCancelable, emitForCharacter } from './chargePoolHooks.js';
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
	CharacterActorLike,
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
			console.warn(
				`[Nimble] chargeConsumer could not resolve pool "${consumer.poolIdentifier}" ` +
					`on item "${item.name}". Check that a matching chargePool rule exists ` +
					`and the identifier is spelled correctly.`,
			);
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
			console.warn(
				`[Nimble] chargeConsumer could not resolve pool "${consumer.poolIdentifier}" ` +
					`on item "${item.name}". Check that a matching chargePool rule exists ` +
					`and the identifier is spelled correctly.`,
			);
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
	}

	const beforeConsumePayload = {
		item: ruleBackedItem as Item.Implementation,
		actor: actor as CharacterActorLike,
		pools: consumers.map((c) => {
			const pool = nextPools[c.poolId];
			return {
				poolId: c.poolId,
				poolLabel: pool?.label ?? c.poolIdentifier,
				cost: c.cost,
				currentValue: pool?.current ?? 0,
			};
		}),
		context,
	};

	if (!emitCancelable('beforeConsume', beforeConsumePayload)) {
		return {
			ok: false,
			failure: {
				code: 'consumptionBlocked',
				poolIdentifier: '',
				poolLabel: '',
				required: 0,
				available: 0,
			},
		};
	}

	for (const consumer of consumers) {
		const pool = nextPools[consumer.poolId];
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

		emitForCharacter(actor, 'consumed', {
			item: ruleBackedItem as Item.Implementation,
			actor: actor as CharacterActorLike,
			consumption: consumption.map((c) => ({
				poolId:
					Object.entries(postRecoveryPools).find(([, p]) => p.label === c.poolLabel)?.[0] ?? '',
				poolLabel: c.poolLabel,
				previousValue: c.previousValue,
				currentValue: c.currentValue,
				cost: Math.abs(c.change),
			})),
		});

		const recoveryEntries = consumption
			.filter((c) => c.recovery)
			.map((c) => ({
				poolId:
					Object.entries(postRecoveryPools).find(([, p]) => p.label === c.poolLabel)?.[0] ?? '',
				poolLabel: c.poolLabel,
				previousValue: c.recovery!.previousValue,
				newValue: c.recovery!.newValue,
				recoveredAmount: c.recovery!.newValue - c.recovery!.previousValue,
			}));

		if (recoveryEntries.length > 0) {
			const primaryTrigger = recoveryEntries[0].poolId
				? resolveRecoveryTrigger(postRecoveryPools[recoveryEntries[0].poolId], triggers)
				: (triggers[0] ?? 'onHit');
			emitForCharacter(actor, 'recovered', {
				actor: actor as CharacterActorLike,
				trigger: primaryTrigger,
				recovery: recoveryEntries,
			});
		}

		for (const [poolId, postRecoveryPool] of Object.entries(postRecoveryPools)) {
			const prePool = currentPools[poolId];
			if (!prePool || prePool.current === postRecoveryPool.current) continue;
			emitForCharacter(actor, 'changed', {
				actor: actor as CharacterActorLike,
				poolId,
				poolLabel: postRecoveryPool.label,
				previousValue: prePool.current,
				newValue: postRecoveryPool.current,
				maxValue: postRecoveryPool.max,
				reason: 'consume',
				trigger: triggers[0],
			});
		}
	}

	return { ok: true, consumption };
}

export { validateItemChargeConsumption, consumeOnResolvedItemUse };
