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

/**
 * Every charge pool on the actor, including pools flagged `hidden`. This is the
 * complete enumeration: it backs authoring UI (the pool picker has to offer a
 * hidden pool so a consumer can target it) as well as the display paths, which
 * drop hidden pools themselves. Rendering code should go through
 * `getPoolsForItem` rather than filtering this list again.
 */
function getPools(actor: Actor | null | undefined): ChargePoolState[] {
	if (!isCharacterActor(actor)) return [];

	return Object.values(buildEffectiveChargePoolMap(actor)).sort((a, b) =>
		a.label.localeCompare(b.label),
	);
}

/**
 * The pools shown alongside an item: the ones it declares plus the ones it
 * spends from. This is a display query, so pools flagged `hidden` are dropped
 * here. Validation and consumption read the pool map directly and are unaffected,
 * which is what lets a hidden pool keep gating the item while contributing no
 * badge of its own.
 */
function getPoolsForItem(
	actor: Actor | null | undefined,
	itemId: string,
	pools?: ChargePoolState[],
): ChargePoolState[] {
	if (!isCharacterActor(actor)) return [];
	const normalizedItemId = normalizeIdentifier(itemId);
	if (normalizedItemId.length < 1) return [];

	const availablePools = (pools ?? getPools(actor)).filter((pool) => !pool.hidden);
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
