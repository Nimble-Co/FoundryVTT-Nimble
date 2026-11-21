import type { ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import type { CostPayer, UseCost } from '#types/useCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { ACTOR_HP_PATHS, ACTOR_WOUNDS_PATHS } from '../actor/actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from '../actor/actorResources.js';

const ACTOR_TEMP_HP_PATH = 'system.attributes.hp.temp';

function fixedResourceCost(kind: ResourceCostKind, amount: number): ResourceCost {
	return { kind, amount, spend: { mode: 'fixed' }, beyond: 'notAllowed' };
}

/** The mana and Wound parts of a use cost, in the order they are spent. */
function resourceCostsOf(cost: UseCost): ResourceCost[] {
	const costs: ResourceCost[] = [];
	if (cost.manaCost > 0) costs.push(fixedResourceCost('mana', cost.manaCost));
	if (cost.woundCost > 0) costs.push(fixedResourceCost('wounds', cost.woundCost));
	return costs;
}

/** The amount of a fixed numeric cost, or null for one this ledger cannot resolve yet. */
function fixedAmountOf(cost: ResourceCost): number | null {
	if (cost.spend.mode !== 'fixed') return null;
	const amount = Number(cost.amount);
	return Number.isFinite(amount) ? Math.max(0, amount) : null;
}

/** A cost whose amount is a roll, such as `1d4`, not yet rolled. */
function isRolledCost(cost: ResourceCost): boolean {
	return (
		cost.spend.mode === 'fixed' &&
		typeof cost.amount === 'string' &&
		cost.amount.trim() !== '' &&
		!Number.isFinite(Number(cost.amount))
	);
}

function rollOf(actor: CostPayer, formula: string) {
	return new Roll(formula, (actor?.getRollData?.() ?? {}) as Record<string, unknown>);
}

function wholeAmount(value: unknown): number {
	const amount = Math.floor(Number(value));
	return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

/** The least the cost can take: a variable cost's minimum, or a roll's lowest result. */
function lowestAmountOf(actor: CostPayer, cost: ResourceCost): number | null {
	if (cost.spend.mode === 'variable') return wholeAmount(cost.spend.min);
	if (isRolledCost(cost)) {
		return wholeAmount(rollOf(actor, String(cost.amount)).evaluateSync({ minimize: true }).total);
	}
	return fixedAmountOf(cost);
}

function manaOf(actor: CostPayer): number {
	return Number(foundry.utils.getProperty(actor ?? {}, 'system.resources.mana.current') ?? 0);
}

async function writeMana(actor: CostPayer, value: number): Promise<void> {
	await actor?.update({ 'system.resources.mana.current': value } as Record<string, unknown>);
}

function woundsOf(actor: CostPayer) {
	return getActorWoundsValueAndMax(actor as Actor.Implementation);
}

function hpOf(actor: CostPayer): number {
	return Number(foundry.utils.getProperty(actor ?? {}, ACTOR_HP_PATHS.value) ?? 0);
}

function tempHpOf(actor: CostPayer): number {
	return Number(foundry.utils.getProperty(actor ?? {}, ACTOR_TEMP_HP_PATH) ?? 0);
}

/** The most of a kind the creature can spend or sacrifice: HP keeps 1, Wounds stop at the max. */
function availableOf(actor: CostPayer, kind: ResourceCostKind): number {
	switch (kind) {
		case 'mana':
			return manaOf(actor);
		case 'hp':
			return Math.max(0, hpOf(actor) - 1);
		case 'tempHp':
			return tempHpOf(actor);
		case 'wounds': {
			const wounds = woundsOf(actor);
			return wounds ? Math.max(0, wounds.max - wounds.value) : 0;
		}
	}
}

function hasEnough(actor: CostPayer, kind: ResourceCostKind, amount: number): boolean {
	return availableOf(actor, kind) >= amount;
}

/**
 * Whether the creature can cover the cost now, by its lowest amount. With Resource Spending
 * off, every cost can.
 */
function canSpendResource(actor: CostPayer, cost: ResourceCost): boolean {
	if (!isResourceSpendingAutomationEnabled()) return true;
	const amount = lowestAmountOf(actor, cost);
	if (amount === null) return false;
	return amount === 0 || hasEnough(actor, cost.kind, amount);
}

/**
 * The range a player can choose a variable cost from. The top is the max formula, and also
 * what the creature has while Resource Spending is on. Null for a cost that is not variable.
 */
function variableRangeOf(
	actor: CostPayer,
	cost: ResourceCost,
): { minimum: number; limit: number } | null {
	if (cost.spend.mode !== 'variable') return null;
	const minimum = wholeAmount(cost.spend.min);
	const max = wholeAmount(cost.spend.max);
	const limit = isResourceSpendingAutomationEnabled()
		? Math.min(max, availableOf(actor, cost.kind))
		: max;
	return { minimum, limit: Math.max(minimum, limit) };
}

/**
 * The cost with its amount fixed for this use: a variable cost takes the chosen amount inside
 * its range, and a roll is rolled now. The ledger then checks and spends it as a fixed cost.
 */
async function settleResourceCost(
	actor: CostPayer,
	cost: ResourceCost,
	chosen?: number,
): Promise<ResourceCost> {
	const range = variableRangeOf(actor, cost);
	if (range) {
		const amount = Math.min(range.limit, Math.max(range.minimum, wholeAmount(chosen ?? 0)));
		return { ...cost, amount, spend: { mode: 'fixed' } };
	}
	if (isRolledCost(cost)) {
		const roll = await rollOf(actor, String(cost.amount)).evaluate();
		return { ...cost, amount: wholeAmount(roll.total), roll: String(cost.amount) };
	}
	return cost;
}

/**
 * Take the cost from the creature. Gives the amount taken, or null when the
 * creature cannot cover it and nothing was taken. With Resource Spending off,
 * nothing is taken.
 */
async function spendResource(actor: CostPayer, cost: ResourceCost): Promise<number | null> {
	if (!isResourceSpendingAutomationEnabled()) return 0;
	const amount = fixedAmountOf(cost);
	if (amount === 0) return 0;
	if (amount === null || !hasEnough(actor, cost.kind, amount)) return null;
	switch (cost.kind) {
		case 'mana':
			await writeMana(actor, manaOf(actor) - amount);
			return amount;
		case 'hp':
			await actor?.update({ [ACTOR_HP_PATHS.value]: hpOf(actor) - amount } as Record<
				string,
				unknown
			>);
			return amount;
		case 'tempHp':
			await actor?.update({ [ACTOR_TEMP_HP_PATH]: tempHpOf(actor) - amount } as Record<
				string,
				unknown
			>);
			return amount;
		case 'wounds':
			await actor?.update({
				[ACTOR_WOUNDS_PATHS.value]: (woundsOf(actor)?.value ?? 0) + amount,
			} as Record<string, unknown>);
			return amount;
	}
}

export {
	canSpendResource,
	fixedResourceCost,
	hpOf,
	isRolledCost,
	lowestAmountOf,
	manaOf,
	resourceCostsOf,
	settleResourceCost,
	spendResource,
	tempHpOf,
	variableRangeOf,
	woundsOf,
	writeMana,
};
