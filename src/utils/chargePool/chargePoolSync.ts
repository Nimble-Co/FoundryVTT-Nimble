import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import {
	areChargePoolMapsEqual,
	buildEffectiveChargePoolMap,
	getChargeConsumers,
	getChargePoolMapFromActor,
	isCharacterActor,
	normalizeIdentifier,
	persistChargePoolMap,
} from './helpers.js';
import type { ChargePoolState, RuleBackedItem } from './types.js';

function isChargePoolFlagUpdate(options: unknown): boolean {
	if (!options || typeof options !== 'object') return false;
	return Boolean(
		foundry.utils.getProperty(options, `${ChargePoolRuleConfig.flagScope}.skipChargePoolSync`),
	);
}

function getPools(actor: Actor | null | undefined): ChargePoolState[] {
	if (!isCharacterActor(actor)) return [];

	return Object.values(buildEffectiveChargePoolMap(actor)).sort((a, b) =>
		a.label.localeCompare(b.label),
	);
}

function getPoolsForItem(
	actor: Actor | null | undefined,
	itemId: string,
	pools?: ChargePoolState[],
): ChargePoolState[] {
	if (!isCharacterActor(actor)) return [];
	const normalizedItemId = normalizeIdentifier(itemId);
	if (normalizedItemId.length < 1) return [];

	const availablePools = pools ?? getPools(actor);
	const item = actor.items.get(normalizedItemId) as RuleBackedItem | undefined;
	if (!item) {
		return availablePools.filter((pool) => pool.sourceItemId === normalizedItemId);
	}

	const consumers = getChargeConsumers(actor, item);
	const consumerPoolIds = new Set(consumers.map((consumer) => consumer.poolId));
	return availablePools.filter(
		(pool) => pool.sourceItemId === normalizedItemId || consumerPoolIds.has(pool.id),
	);
}

async function syncActorPools(actor: Actor | null | undefined): Promise<void> {
	if (!isCharacterActor(actor)) return;

	const existingPools = getChargePoolMapFromActor(actor);
	const nextPools = buildEffectiveChargePoolMap(actor);
	if (areChargePoolMapsEqual(existingPools, nextPools)) return;

	await persistChargePoolMap(actor, nextPools);
}

export { isChargePoolFlagUpdate, getPools, getPoolsForItem, syncActorPools };
