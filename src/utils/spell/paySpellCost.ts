import type { CostReceipt } from '#types/costReceipt.d.ts';
import type { ResourceCost } from '#types/resourceCost.d.ts';
import type {
	ResolvedSpellCost,
	SpellCostActorLike,
	SpellCostFailure,
} from '#types/spellCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { hasRuleCharge, spendRuleCharge } from '../chargePool/ruleChargeGate.js';
import { giveBack, receiptOf, spendMana } from '../cost/costLedger.js';
import { resourceCostRefusal } from '../cost/itemResourceCosts.js';
import { goesBeyond, manaOf, spendResource } from '../cost/resourceCost.js';
import localize from '../localize.js';
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
	/** Set when another cost of the cast was refused: the words to report. */
	notice?: string;
	/** Set when the cast was paid for by exceeding the pool. */
	overdrawn?: boolean;
	/** Damage the overdraft consequence dealt, if any. */
	damage?: number;
	/** What the cast took, to give back when it does not happen. Set when paid. */
	receipt?: CostReceipt;
	/** What the other costs took, to give back when the cast does not happen. Set when paid. */
	receipts?: CostReceipt[];
	/** The other costs as the cast took them. With Resource Spending off, as they were asked. */
	taken?: ResourceCost[];
	/** The other costs that went beyond what the caster had, whose consequences still apply. */
	beyond?: ResourceCost[];
}

/** A Charge Pool one use of which the cast spends, such as an option's limit. */
export interface CastPoolUse {
	identifier: string;
	label: string;
}

interface CastCosts {
	/** Costs spent with the spell: its Spend or Sacrifice costs and the options turned on. */
	costs?: readonly ResourceCost[];
	/** Pools that lose one use with the cast. */
	pools?: readonly CastPoolUse[];
	/** Asks the player to confirm costs that go beyond what the caster has. */
	confirmBeyond?: (costs: ResourceCost[]) => Promise<boolean>;
}

function fixedMana(cost: ResourceCost): number | null {
	const amount = Number(cost.amount);
	return cost.kind === 'mana' && Number.isFinite(amount) ? Math.max(0, amount) : null;
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
 * Why the cast cannot go ahead now, or null when it can. The spell mana and the mana of the
 * other costs are checked as one total.
 */
function castRefusal(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
	costs: readonly ResourceCost[],
	pools: readonly CastPoolUse[],
): { failure?: SpellCostFailure; notice?: string; overdrawn?: boolean; available?: number } | null {
	const spellMana = cost.type === 'mana' ? cost.amount : 0;
	const plainMana = plainManaOf(costs);
	const total: ResolvedSpellCost =
		cost.type === 'mana' ? { type: 'mana', amount: spellMana + plainMana } : cost;
	const validation = validateSpellCost(actor, total);
	if (!validation.ok) return { failure: validation.failure };
	if (cost.type !== 'mana' && plainMana > manaOf(actor as never)) {
		return {
			failure: {
				code: 'insufficientMana',
				poolIdentifier: 'mana',
				poolLabel: 'mana',
				required: plainMana,
				available: manaOf(actor as never),
			},
		};
	}
	const notice = resourceCostRefusal(
		actor as never,
		costs.filter((each) => fixedMana(each) === null),
	);
	if (notice) return { notice };
	const empty = pools.find((pool) => !hasRuleCharge(actor as never, pool.identifier));
	if (empty) return { notice: localize('NIMBLE.useOptions.noUseLeft', { pool: empty.label }) };
	return validation.overdrawn ? { overdrawn: true, available: validation.available } : null;
}

/**
 * Pays for a cast, in one step: validate, confirm an overdraw if the cost
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
export async function paySpellCost(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
	{
		confirmOverdraft,
		costs = [],
		pools = [],
		confirmBeyond = async () => false,
	}: { confirmOverdraft: (available: number) => Promise<boolean> | boolean } & CastCosts,
): Promise<SpellCostPayment> {
	if (!isResourceSpendingAutomationEnabled()) {
		return { paid: true, receipt: receiptOf(), receipts: [], taken: [...costs], beyond: [] };
	}

	const refusal = castRefusal(actor, cost, costs, pools);
	if (refusal && !refusal.overdrawn) return { paid: false, ...refusal };

	const spellMana = cost.type === 'mana' ? cost.amount : 0;
	const firstShares = manaShares(manaOf(actor as never) - spellMana, costs);
	const otherBeyond = costs.filter((each, index) => {
		const share = firstShares[index];
		return share ? share.beyond : goesBeyond(actor as never, each);
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

	const shares = manaShares(manaOf(actor as never) - spellMana, costs);
	const otherMana = shares.reduce((total, share) => total + (share?.take ?? 0), 0);
	const receipts: CostReceipt[] = [];
	const fail = async (result: SpellCostPayment): Promise<SpellCostPayment> => {
		for (const receipt of receipts) await giveBack(actor as never, receipt);
		return result;
	};

	if (spellMana + otherMana > 0) {
		if (!(await spendMana(actor as never, spellMana + otherMana))) {
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
		const amount = await spendResource(actor as never, each);
		if (amount === null) {
			return fail({ paid: false, notice: resourceCostRefusal(actor as never, [each]) ?? '' });
		}
		const part = receiptOf();
		if (each.kind === 'hp') part.paid.hp = amount;
		else if (each.kind === 'tempHp') part.paid.tempHp = amount;
		else if (each.kind === 'wounds') part.paid.wounds = amount;
		receipts.push(part);
		taken.push({ ...each, amount });
	}

	for (const pool of pools) {
		if (!(await spendRuleCharge(actor as never, pool.identifier))) {
			return fail({
				paid: false,
				notice: localize('NIMBLE.useOptions.noUseLeft', { pool: pool.label }),
			});
		}
		receipts.push(receiptOf({ charges: 1, chargePoolIdentifier: pool.identifier }));
	}

	const others = receipts.filter((each) => each !== receipt);
	const result = { paid: true, receipt, receipts: others, taken, beyond: otherBeyond };
	if (!overdrawn) return result;
	const damage = await applyOverdraftConsequence(actor, cost);
	return { ...result, overdrawn: true, damage };
}
