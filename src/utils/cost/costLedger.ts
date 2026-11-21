import type { CostReceipt, CostsSpent } from '#types/costReceipt.d.ts';
import type { ConfirmBeyond, ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import type { CostPayer, PaidUseCost, UseCost } from '#types/useCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { refundRuleCharge, spendRuleCharge } from '../chargePool/ruleChargeGate.js';
import { clearTurnUse, markTurnUse, usedThisTurn } from '../combat/perTurnUse.js';
import { queueCombatantMutationWithFreshDocument } from '../combat/queueCombatantMutationWithFreshDocument.js';
import {
	buildCombatantActionDeltaUpdate,
	requestCombatantActionDelta,
} from '../combat/requestCombatantActionDelta.js';
import { setPoolFaces } from '../dicePool/dicePoolRefill.js';
import { getPools } from '../dicePool/dicePoolSync.js';
import {
	getHeroicReactionAvailabilityUpdate,
	type HeroicReactionKey,
} from '../incomingReactions/heroicActions.js';
import {
	fixedAmountOf,
	fixedResourceCost,
	goesBeyond,
	RESOURCE_COST_KINDS,
	resourceCostsOf,
	returnResource,
	spendResource,
	usedBefore,
} from './resourceCost.js';
import {
	actionCostOf,
	actionPayer,
	canSpendActions,
	findActorCombatant,
	poolToExpend,
	turnStampOf,
} from './useCost.js';

/** The receipt of Mana or pool charges a use took. With no amount, the use cost nothing. */
function receiptOf(
	taken: { mana?: number; charges?: number; chargePoolIdentifier?: string } = {},
): CostReceipt {
	const { mana = 0, charges = 0, chargePoolIdentifier = '' } = taken;
	return {
		cost: {
			chargePoolIdentifier,
			chargeCost: charges,
			manaCost: mana,
			woundCost: 0,
			heroicReaction: '',
		},
		paid: { ...nothingPaid(), mana, charges },
	};
}

interface HeroicReactionCombat {
	id?: string | null;
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	) => Promise<boolean>;
	updateEmbeddedDocuments?: (type: 'Combatant', updates: Record<string, unknown>[]) => unknown;
}

function nothingPaid(): PaidUseCost {
	return { charges: 0, mana: 0, wounds: 0, heroicReaction: null, action: null };
}

/** Take `amount` Mana. Mana has no overdraft: with too little, nothing is taken and this is false. */
async function spendMana(actor: CostPayer, amount: number): Promise<boolean> {
	return (await spendResource(actor, fixedResourceCost('mana', amount))) !== null;
}

/** Record what a resource spend took on the paid record. */
function recordTaken(paid: PaidUseCost, kind: ResourceCostKind, taken: number): void {
	paid[kind] = (paid[kind] ?? 0) + taken;
}

async function spendHeroicReaction(
	actor: CostPayer,
	key: HeroicReactionKey,
	force: boolean,
): Promise<PaidUseCost['heroicReaction'] | false> {
	const found = findActorCombatant(actor);
	const combat = found?.combat as unknown as HeroicReactionCombat | undefined;
	if (!found?.combatant.id || !combat?.useHeroicReactions) return null;

	const actions = () =>
		Number(foundry.utils.getProperty(found.combatant, 'system.actions.base.current') ?? 0);
	const before = actions();
	const used = await combat.useHeroicReactions(found.combatant.id, [key], { force });
	if (!used) return false;
	return {
		combatId: combat.id ?? '',
		combatantId: found.combatant.id,
		key,
		actionsSpent: Math.max(0, before - actions()),
	};
}

async function spendActions(
	actor: CostPayer,
	amount: number,
): Promise<PaidUseCost['action'] | false> {
	const payer = actionPayer(actor);
	if (!payer?.combatant.id) return null;
	if (!canSpendActions(actor, amount)) return false;
	const paid = {
		combatId: payer.combat.id ?? '',
		combatantId: payer.combatant.id,
		amount,
		now: payer.now,
	};
	const done = await changeActions(paid, -amount);
	return done ? paid : false;
}

function changeActions(paid: NonNullable<PaidUseCost['action']>, delta: number) {
	const combat = game.combat ?? null;
	if (!combat || (combat.id ?? '') !== paid.combatId) return Promise.resolve(false);
	return requestCombatantActionDelta({
		combat,
		combatantId: paid.combatantId,
		sourceItemUuid: '',
		deltas: paid.now
			? { currentDelta: delta, pendingDelta: 0 }
			: { currentDelta: 0, pendingDelta: delta },
	});
}

async function refundHeroicReaction(paid: NonNullable<PaidUseCost['heroicReaction']>) {
	const combat = game.combat ?? null;
	if (!combat || (combat.id ?? '') !== paid.combatId) return;
	await queueCombatantMutationWithFreshDocument({
		combat,
		combatantId: paid.combatantId,
		mutation: async (combatant) => {
			const actions =
				paid.actionsSpent > 0
					? buildCombatantActionDeltaUpdate(combatant, {
							currentDelta: paid.actionsSpent,
							pendingDelta: 0,
						})
					: null;
			await (combat as unknown as HeroicReactionCombat).updateEmbeddedDocuments?.('Combatant', [
				{
					_id: paid.combatantId,
					...actions,
					...getHeroicReactionAvailabilityUpdate(paid.key, true),
				},
			]);
		},
	});
}

/** Give back what `payCost` charged. */
async function giveBack(actor: CostPayer, { cost, paid }: CostReceipt): Promise<void> {
	for (const kind of RESOURCE_COST_KINDS) {
		const amount = paid[kind] ?? 0;
		if (amount > 0) await returnResource(actor, kind, amount);
	}
	if (paid.charges > 0) await refundRuleCharge(actor, cost.chargePoolIdentifier, paid.charges);
	if (paid.dice) {
		const current = getPools(actor).find((pool) => pool.id === paid.dice?.poolId)?.faces ?? [];
		await setPoolFaces(actor, paid.dice.poolId, [...current, ...paid.dice.faces], 'refund');
	}
	if (paid.turnUse && cost.turnUseKey) await clearTurnUse(actor, cost.turnUseKey);
	if (paid.action) await changeActions(paid.action, paid.action.amount);
	if (paid.heroicReaction) await refundHeroicReaction(paid.heroicReaction);
}

/**
 * Charge a cost: the heroic reaction first, as the part most
 * likely to be refused, then actions, charges, dice, mana and Wounds. When a part fails,
 * the parts already charged are given back and null is returned. With
 * resource spending automation off, only the heroic reaction is spent, as
 * for every other heroic reaction.
 */
async function payCost(
	actor: CostPayer,
	cost: UseCost,
	options: { forceHeroicReaction?: boolean } = {},
): Promise<PaidUseCost | null> {
	const paid = nothingPaid();
	const fail = async () => {
		await giveBack(actor, { cost, paid });
		return null;
	};

	if (cost.heroicReaction) {
		const spent = await spendHeroicReaction(
			actor,
			cost.heroicReaction,
			options.forceHeroicReaction === true,
		);
		if (spent === false) return null;
		paid.heroicReaction = spent;
		if (spent) paid.stamp = turnStampOf(game.combat);
	}
	if (!isResourceSpendingAutomationEnabled()) return paid;

	const actions = actionCostOf(cost);
	if (actions > 0) {
		if (cost.actionReportOnly && !canSpendActions(actor, actions)) {
			paid.noActionLeft = true;
		} else {
			const spent = await spendActions(actor, actions);
			if (spent === false) return fail();
			paid.action = spent;
			if (spent) paid.stamp ??= turnStampOf(game.combat);
		}
	}

	if (cost.turnUseKey) {
		if (usedThisTurn(actor, cost.turnUseKey)) return fail();
		await markTurnUse(actor, cost.turnUseKey);
		paid.turnUse = true;
	}

	if (cost.chargePoolIdentifier.trim()) {
		const amount = Math.max(1, cost.chargeCost);
		if (!(await spendRuleCharge(actor, cost.chargePoolIdentifier, amount))) return fail();
		paid.charges = amount;
	}

	if (cost.dicePoolIdentifier?.trim()) {
		const pool = poolToExpend(actor, cost);
		if (!pool?.faces.length) return fail();
		if (!(await setPoolFaces(actor, pool.id, []))) return fail();
		paid.dice = { poolId: pool.id, faces: [...pool.faces] };
	}

	for (const part of resourceCostsOf(cost)) {
		const taken = await spendResource(actor, part);
		if (taken === null) return fail();
		recordTaken(paid, part.kind, taken);
	}

	return paid;
}

interface ResourceCostsSpent extends CostsSpent {
	receipt: CostReceipt;
}

/**
 * Spend each cost of an item's own use, in order. When a cost allowed beyond what the
 * creature has needs more than it has, `confirmBeyond` asks first. When the player
 * declines, or a cost cannot be covered, what was taken is given back and null is returned.
 */
async function spendResourceCosts(
	actor: CostPayer,
	costs: readonly ResourceCost[],
	{ confirmBeyond = async () => false }: { confirmBeyond?: ConfirmBeyond } = {},
): Promise<ResourceCostsSpent | null> {
	const used = usedBefore(costs, (cost) => fixedAmountOf(cost) ?? 0);
	const beyond = costs.filter((cost, index) => goesBeyond(actor, cost, used[index]));
	if (beyond.length > 0 && !(await confirmBeyond(beyond))) return null;

	const receipt = receiptOf();
	const taken: ResourceCost[] = [];
	for (const cost of costs) {
		const amount = await spendResource(actor, cost).catch(async (error) => {
			await giveBack(actor, receipt);
			throw error;
		});
		if (amount === null) {
			await giveBack(actor, receipt);
			return null;
		}
		recordTaken(receipt.paid, cost.kind, amount);
		taken.push(isResourceSpendingAutomationEnabled() ? { ...cost, amount } : cost);
	}
	return { receipt, taken, beyond };
}

/**
 * Give back the part of a per-die payment for dice that did not roll. Gives the
 * payment that is still paid.
 */
async function giveBackPart(
	actor: CostPayer,
	{ cost, paid }: CostReceipt,
	dieCount: number,
	skipped: number,
): Promise<PaidUseCost> {
	const part = (amount: number) => (amount / dieCount) * skipped;
	await giveBack(actor, {
		cost,
		paid: {
			...paid,
			charges: part(paid.charges),
			mana: part(paid.mana),
			wounds: part(paid.wounds),
			heroicReaction: null,
			action: null,
			turnUse: false,
		},
	});
	return {
		...paid,
		charges: paid.charges - part(paid.charges),
		mana: paid.mana - part(paid.mana),
		wounds: paid.wounds - part(paid.wounds),
	};
}

export { giveBack, giveBackPart, payCost, receiptOf, recordTaken, spendMana, spendResourceCosts };
