import { DicePoolRuleConfig } from './dicePoolRuleConfig.js';
import {
	areDicePoolMapsEqual,
	buildEffectiveDicePoolMap,
	getDicePoolMapFromActor,
	isCharacterActor,
	normalizeIdentifier,
	persistDicePoolMap,
} from './helpers.js';
import type { DicePoolState } from './types.js';

function isDicePoolFlagUpdate(options: unknown): boolean {
	if (!options || typeof options !== 'object') return false;
	return Boolean(
		foundry.utils.getProperty(options, `${DicePoolRuleConfig.flagScope}.skipDicePoolSync`),
	);
}

function getPools(actor: Actor | null | undefined): DicePoolState[] {
	if (!isCharacterActor(actor)) return [];

	return Object.values(buildEffectiveDicePoolMap(actor)).sort((a, b) =>
		a.label.localeCompare(b.label),
	);
}

function getPoolsForItem(
	actor: Actor | null | undefined,
	itemId: string,
	pools?: DicePoolState[],
): DicePoolState[] {
	if (!isCharacterActor(actor)) return [];
	const normalizedItemId = normalizeIdentifier(itemId);
	if (normalizedItemId.length < 1) return [];

	const availablePools = pools ?? getPools(actor);
	return availablePools.filter((pool) => pool.sourceItemId === normalizedItemId);
}

/**
 * Reconcile the actor's dicePool flag state against current rule definitions.
 * Does NOT roll new dice — that's the refill subsystem's responsibility.
 * Use this when:
 *   - items/rules are added/updated/deleted
 *   - actor formula inputs change (max/dieSize may shift via modifiers)
 */
async function syncActorPools(actor: Actor | null | undefined): Promise<void> {
	if (!isCharacterActor(actor)) return;

	const existingPools = getDicePoolMapFromActor(actor);
	const nextPools = buildEffectiveDicePoolMap(actor);
	if (areDicePoolMapsEqual(existingPools, nextPools)) return;

	await persistDicePoolMap(actor, nextPools);
}

export { getPools, getPoolsForItem, isDicePoolFlagUpdate, syncActorPools };
