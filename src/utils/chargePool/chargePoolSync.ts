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
 * The pools the sheet header presents as standing resources, in the same order
 * as {@link getPools}.
 *
 * `hidden` wins over `showAsResource`: a pool that opts out of the readouts
 * entirely is not promoted, so the two flags cannot contradict each other on
 * screen. Every promoted pool still keeps its badge on the item that grants it;
 * the header is an addition, not a move.
 */
function getResourcePools(actor: Actor | null | undefined): ChargePoolState[] {
	return getPools(actor).filter((pool) => pool.showAsResource && !pool.hidden);
}

/**
 * The pools belonging to an item: the ones it declares plus the ones it spends
 * from.
 *
 * By default this is the readout query, so pools flagged `hidden` are dropped.
 * Pass `includeHidden` for the management surfaces, where someone correcting a
 * pool by hand has to be able to reach one that carries no badge. Hiding a pool
 * removes it from what the player reads, not from what a GM can fix.
 *
 * Validation and consumption read the pool map directly and are unaffected
 * either way, which is what lets a hidden pool keep gating the item while
 * contributing no badge of its own.
 */
function getPoolsForItem(
	actor: Actor | null | undefined,
	itemId: string,
	pools?: ChargePoolState[],
	{ includeHidden = false }: { includeHidden?: boolean } = {},
): ChargePoolState[] {
	if (!isCharacterActor(actor)) return [];
	const normalizedItemId = normalizeIdentifier(itemId);
	if (normalizedItemId.length < 1) return [];

	const availablePools = (pools ?? getPools(actor)).filter((pool) => includeHidden || !pool.hidden);
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

export { isChargePoolFlagUpdate, getPools, getPoolsForItem, getResourcePools, syncActorPools };
