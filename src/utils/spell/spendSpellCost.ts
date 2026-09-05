import type {
	ResolvedSpellCost,
	SpellCostActorLike,
	SpellCostOutcome,
} from '#types/spellCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { emitForCharacter } from '../chargePool/chargePoolHooks.js';
import {
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	findChargePoolByIdentifier,
	persistChargePoolMap,
} from '../chargePool/helpers.js';
import { asChargePoolActor } from './asChargePoolActor.js';
import { validateSpellCost } from './validateSpellCost.js';

/**
 * Pays the resolved cost: deducts mana, or deducts from the declared pool,
 * flooring at zero. Does not apply an overdraft consequence; the caller does
 * that after this resolves with `overdrawn: true`. With resource spending
 * automation off, nothing is deducted.
 */
export async function spendSpellCost(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
): Promise<SpellCostOutcome> {
	if (!isResourceSpendingAutomationEnabled()) return { ok: true, overdrawn: false };
	if (cost.type === 'none') return { ok: true, overdrawn: false };

	if (cost.type === 'mana') {
		const currentMana = actor?.system?.resources?.mana?.current || 0;
		await actor.update?.({
			'system.resources.mana.current': Math.max(0, currentMana - cost.amount),
		});
		return { ok: true, overdrawn: false };
	}

	// Re-checked here rather than trusted from the caller: an overdraft
	// confirmation is awaited between the first check and this spend, and
	// anything that resolves in that window can drain the pool.
	const validation = validateSpellCost(actor, cost);
	if (!validation.ok) return validation;

	const pools = buildEffectiveChargePoolMap(asChargePoolActor(actor));
	const poolEntry = findChargePoolByIdentifier(pools, cost.poolIdentifier);
	if (!poolEntry) return validation;

	const previousValue = poolEntry.pool.current;
	poolEntry.pool.current = clampCurrentToMax(
		Math.max(0, previousValue - cost.amount),
		poolEntry.pool.max,
	);
	await persistChargePoolMap(asChargePoolActor(actor), pools);

	emitForCharacter(asChargePoolActor(actor), 'changed', {
		actor: asChargePoolActor(actor),
		poolId: poolEntry.key,
		poolLabel: poolEntry.pool.label,
		previousValue,
		newValue: poolEntry.pool.current,
		maxValue: poolEntry.pool.max,
		reason: 'consume',
	});

	return { ok: true, overdrawn: validation.overdrawn };
}
