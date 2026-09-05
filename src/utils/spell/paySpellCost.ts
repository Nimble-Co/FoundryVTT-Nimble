import type {
	ResolvedSpellCost,
	SpellCostActorLike,
	SpellCostFailure,
} from '#types/spellCost.d.ts';
import { applyOverdraftConsequence } from './spellCost.js';
import { spendSpellCost } from './spendSpellCost.js';
import { validateSpellCost } from './validateSpellCost.js';

export interface SpellCostPayment {
	/** False means the cast must not proceed. */
	paid: boolean;
	/** Set when the caster declined to overdraw; there is nothing to report. */
	cancelled?: boolean;
	/** Set when the cast was refused; the caller reports it. */
	failure?: SpellCostFailure;
	/** Set when the cast was paid for by exceeding the pool. */
	overdrawn?: boolean;
	/** Damage the overdraft consequence dealt, if any. */
	damage?: number;
}

/**
 * Pays for a cast, in one step: validate, confirm an overdraw if the cost
 * permits one, spend, and apply the declared consequence.
 *
 * This is one operation rather than a validate call and a later spend call
 * because anything awaited between the two can drain the pool the check just
 * approved, leaving the spend to fail after the cast has been committed.
 *
 * The caller supplies the confirmation so this stays free of UI, and reports
 * `failure` itself so the message can name the item.
 */
export async function paySpellCost(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
	{ confirmOverdraft }: { confirmOverdraft: (available: number) => Promise<boolean> | boolean },
): Promise<SpellCostPayment> {
	const validation = validateSpellCost(actor, cost);
	if (!validation.ok) return { paid: false, failure: validation.failure };

	if (validation.overdrawn) {
		const confirmed = await confirmOverdraft(validation.available ?? 0);
		if (!confirmed) return { paid: false, cancelled: true };
	}

	const outcome = await spendSpellCost(actor, cost);
	if (!outcome.ok) return { paid: false, failure: outcome.failure };

	if (!outcome.overdrawn) return { paid: true };

	const damage = await applyOverdraftConsequence(actor, cost);
	return { paid: true, overdrawn: true, damage };
}
