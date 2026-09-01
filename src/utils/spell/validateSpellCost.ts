import type {
	ResolvedSpellCost,
	SpellCostActorLike,
	SpellCostOutcome,
} from '#types/spellCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { buildEffectiveChargePoolMap, findChargePoolByIdentifier } from '../chargePool/helpers.js';
import { asChargePoolActor } from './asChargePoolActor.js';

/**
 * Checks whether the actor can pay the resolved cost, without writing
 * anything. `overdrawn: true` means the pool cannot cover the cost but the
 * declared consequence permits the cast anyway; the caller decides whether
 * to confirm and proceed. With resource spending automation off, nothing is
 * validated and every cast is permitted.
 */
export function validateSpellCost(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
): SpellCostOutcome {
	if (!isResourceSpendingAutomationEnabled()) return { ok: true, overdrawn: false };
	if (cost.type === 'none') return { ok: true, overdrawn: false };
	if (cost.type === 'mana') return validateManaCost(actor, cost.amount);

	const pools = buildEffectiveChargePoolMap(asChargePoolActor(actor));
	const poolEntry = findChargePoolByIdentifier(pools, cost.poolIdentifier);
	if (!poolEntry) {
		return {
			ok: false,
			overdrawn: false,
			failure: {
				code: 'poolMissing',
				poolIdentifier: cost.poolIdentifier,
				poolLabel: cost.poolLabel,
				required: cost.amount,
				available: 0,
			},
		};
	}

	if (poolEntry.pool.current >= cost.amount) return { ok: true, overdrawn: false };
	if (cost.overdraftConsequence !== '') {
		return { ok: true, overdrawn: true, available: poolEntry.pool.current };
	}

	return {
		ok: false,
		overdrawn: false,
		failure: {
			code: 'insufficientCharges',
			poolIdentifier: cost.poolIdentifier,
			poolLabel: poolEntry.pool.label,
			required: cost.amount,
			available: poolEntry.pool.current,
		},
	};
}

/** Mana has no overdraft: a cast the caster cannot cover is refused outright. */
function validateManaCost(actor: SpellCostActorLike, amount: number): SpellCostOutcome {
	const available = actor?.system?.resources?.mana?.current ?? 0;
	if (available >= amount) return { ok: true, overdrawn: false };

	return {
		ok: false,
		overdrawn: false,
		failure: {
			code: 'insufficientMana',
			poolIdentifier: 'mana',
			poolLabel: 'mana',
			required: amount,
			available,
		},
	};
}
