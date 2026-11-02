import { buildEffectiveChargePoolMap, getChargeConsumers } from './helpers.js';

/** What a use of this item spends by itself, with what is left in each pool. */
export function fixedChargeCostsOf(actor: unknown, item: unknown) {
	const typedActor = actor as Parameters<typeof getChargeConsumers>[0] & { type?: string };
	if (typedActor?.type !== 'character') return [];
	const pools = buildEffectiveChargePoolMap(typedActor);
	return getChargeConsumers(typedActor, item as never)
		.filter((consumer) => !consumer.variable)
		.map((consumer) => ({
			label: pools[consumer.poolId]?.label ?? consumer.poolIdentifier,
			amount: consumer.cost,
			current: pools[consumer.poolId]?.current ?? 0,
		}));
}
