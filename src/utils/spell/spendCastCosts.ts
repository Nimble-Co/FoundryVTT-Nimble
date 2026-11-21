import type { CostReceipt, CostsSpent } from '#types/costReceipt.d.ts';
import type { ConfirmBeyond, ResourceCost } from '#types/resourceCost.d.ts';
import type { CastCostPayer, ResolvedSpellCost, SpellCostFailure } from '#types/spellCost.d.ts';
import type { PoolUse } from '#types/useOption.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { giveBack, receiptOf, recordTaken, spendMana } from '../cost/costLedger.js';
import { notEnoughNotice, resourceCostRefusal } from '../cost/itemResourceCosts.js';
import { emptyPoolNotice, spendPoolUses } from '../cost/poolUses.js';
import { fixedAmountOf, goesBeyond, manaOf, spendResource } from '../cost/resourceCost.js';
import { applyOverdraftConsequence } from './spellCost.js';
import { spendSpellCost } from './spendSpellCost.js';
import { validateSpellCost } from './validateSpellCost.js';

export interface CastCostsSpent extends Partial<CostsSpent> {
	/** False means the cast must not proceed. */
	paid: boolean;
	/** Set when the caster declined to overdraw; there is nothing to report. */
	cancelled?: boolean;
	/** Set when the cast was refused; the caller reports it. */
	failure?: SpellCostFailure;
	/** Set when another cost of the cast was refused: the words to report. */
	notice?: string;
	/** Set when the cast went beyond the pool. */
	overdrawn?: boolean;
	/** Damage the overdraft consequence dealt, if any. */
	damage?: number;
	/** What the cast took, to give back when it does not happen. Set when spent. */
	receipt?: CostReceipt;
	/** What the other costs took, to give back when the cast does not happen. Set when spent. */
	receipts?: CostReceipt[];
}

interface CastCosts {
	/** Costs spent with the spell: its Spend or Sacrifice costs and the options turned on. */
	costs?: readonly ResourceCost[];
	/** Pools that lose one use with the cast. */
	pools?: readonly PoolUse[];
	confirmBeyond?: ConfirmBeyond;
}

function fixedMana(cost: ResourceCost): number | null {
	return cost.kind === 'mana' ? fixedAmountOf(cost) : null;
}

function plainManaOf(costs: readonly ResourceCost[]): number {
	return costs
		.filter((each) => each.beyond === 'notAllowed')
		.reduce((total, each) => total + (fixedMana(each) ?? 0), 0);
}

/**
 * What each mana cost takes of the mana left after the spell: a cost that cannot go beyond
 * takes its amount, and one that can takes what is left after those. Null for other kinds.
 */
function manaShares(available: number, costs: readonly ResourceCost[]) {
	let left = Math.max(0, available - plainManaOf(costs));
	return costs.map((cost) => {
		const amount = fixedMana(cost);
		if (amount === null) return null;
		if (cost.beyond === 'notAllowed') return { take: amount, beyond: false };
		const take = Math.min(amount, left);
		left -= take;
		return { take, beyond: amount > take };
	});
}

/**
 * Why the cast cannot go ahead now, or null when it can. The spell's own cost is checked first.
 * Then each mana cost that cannot go beyond is checked against the mana left after the spell.
 */
function castRefusal(
	actor: CastCostPayer,
	cost: ResolvedSpellCost,
	costs: readonly ResourceCost[],
	pools: readonly PoolUse[],
): { failure?: SpellCostFailure; notice?: string; overdrawn?: boolean; available?: number } | null {
	const validation = validateSpellCost(actor, cost);
	if (!validation.ok) return { failure: validation.failure };
	let left = Math.max(0, manaOf(actor) - (cost.type === 'mana' ? cost.amount : 0));
	for (const each of costs) {
		const amount = fixedMana(each);
		if (amount === null || each.beyond !== 'notAllowed') continue;
		if (amount > left) return { notice: notEnoughNotice(actor, each, left) };
		left -= amount;
	}
	const notice =
		resourceCostRefusal(
			actor,
			costs.filter((each) => fixedMana(each) === null),
		) ?? emptyPoolNotice(actor, pools);
	if (notice) return { notice };
	return validation.overdrawn ? { overdrawn: true, available: validation.available } : null;
}

/**
 * Spends the costs of a cast, in one step: validate, confirm an overdraw if the cost
 * permits one, spend, and apply the declared consequence. The costs and pool
 * uses that come with the cast are checked and spent in the same step, and the
 * spell mana and their mana are one write.
 *
 * This is one operation rather than a validate call and a later spend call
 * because anything awaited between the two can drain the pool the check just
 * approved, leaving the spend to fail after the cast has been committed.
 *
 * The caller supplies the confirmations so this stays free of UI, and reports
 * `failure` itself so the message can name the item.
 */
export async function spendCastCosts(
	actor: CastCostPayer,
	cost: ResolvedSpellCost,
	{
		confirmOverdraft,
		costs = [],
		pools = [],
		confirmBeyond = async () => false,
	}: { confirmOverdraft: (available: number) => Promise<boolean> | boolean } & CastCosts,
): Promise<CastCostsSpent> {
	if (!isResourceSpendingAutomationEnabled()) {
		return { paid: true, receipt: receiptOf(), receipts: [], taken: [...costs], beyond: [] };
	}

	const refusal = castRefusal(actor, cost, costs, pools);
	if (refusal && !refusal.overdrawn) return { paid: false, ...refusal };

	const spellMana = cost.type === 'mana' ? cost.amount : 0;
	const firstShares = manaShares(manaOf(actor) - spellMana, costs);
	const otherBeyond = costs.filter((each, index) => {
		const share = firstShares[index];
		return share ? share.beyond : goesBeyond(actor, each);
	});

	let waited = false;
	if (refusal?.overdrawn) {
		waited = true;
		if (!(await confirmOverdraft(refusal.available ?? 0))) return { paid: false, cancelled: true };
	}
	if (otherBeyond.length > 0) {
		waited = true;
		if (!(await confirmBeyond(otherBeyond))) return { paid: false, cancelled: true };
	}
	if (waited) {
		const late = castRefusal(actor, cost, costs, pools);
		if (late && !late.overdrawn) return { paid: false, ...late };
	}

	const shares = manaShares(manaOf(actor) - spellMana, costs);
	const otherMana = shares.reduce((total, share) => total + (share?.take ?? 0), 0);
	const receipts: CostReceipt[] = [];
	const fail = async (result: CastCostsSpent): Promise<CastCostsSpent> => {
		for (const receipt of receipts) await giveBack(actor, receipt);
		return result;
	};

	try {
		if (spellMana + otherMana > 0) {
			if (!(await spendMana(actor, spellMana + otherMana))) {
				return fail({ paid: false, ...castRefusal(actor, cost, costs, pools) });
			}
		}
		const receipt = receiptOf({ mana: spellMana });
		receipts.push(receipt, receiptOf({ mana: otherMana }));

		let overdrawn = false;
		if (cost.type === 'pool') {
			const outcome = await spendSpellCost(actor, cost);
			if (!outcome.ok) return fail({ paid: false, failure: outcome.failure });
			overdrawn = outcome.overdrawn;
			Object.assign(
				receipt,
				receiptOf({ charges: outcome.spent ?? 0, chargePoolIdentifier: cost.poolIdentifier }),
			);
		}

		const taken: ResourceCost[] = [];
		for (const [index, each] of costs.entries()) {
			const share = shares[index];
			if (share) {
				taken.push({ ...each, amount: share.take });
				continue;
			}
			const amount = await spendResource(actor, each);
			if (amount === null) {
				return fail({ paid: false, notice: resourceCostRefusal(actor, [each]) ?? '' });
			}
			const part = receiptOf();
			recordTaken(part.paid, each.kind, amount);
			receipts.push(part);
			taken.push({ ...each, amount });
		}

		const poolUses = await spendPoolUses(actor, pools);
		if ('notice' in poolUses) return fail({ paid: false, notice: poolUses.notice });
		receipts.push(...poolUses.receipts);

		const others = receipts.filter((each) => each !== receipt);
		const result = { paid: true, receipt, receipts: others, taken, beyond: otherBeyond };
		if (!overdrawn) return result;
		const damage = await applyOverdraftConsequence(actor, cost);
		return { ...result, overdrawn: true, damage };
	} catch (error) {
		await fail({ paid: false });
		throw error;
	}
}
