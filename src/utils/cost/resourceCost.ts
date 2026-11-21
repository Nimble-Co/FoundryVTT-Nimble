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

function hasEnough(actor: CostPayer, kind: ResourceCostKind, amount: number): boolean {
	switch (kind) {
		case 'mana':
			return manaOf(actor) >= amount;
		case 'hp':
			return hpOf(actor) > amount;
		case 'tempHp':
			return tempHpOf(actor) >= amount;
		case 'wounds': {
			const wounds = woundsOf(actor);
			return !!wounds && wounds.value + amount <= wounds.max;
		}
	}
}

/** Whether the creature can cover the cost now. With Resource Spending off, every cost can. */
function canSpendResource(actor: CostPayer, cost: ResourceCost): boolean {
	if (!isResourceSpendingAutomationEnabled()) return true;
	const amount = fixedAmountOf(cost);
	if (amount === null) return false;
	return amount === 0 || hasEnough(actor, cost.kind, amount);
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
	manaOf,
	resourceCostsOf,
	spendResource,
	tempHpOf,
	woundsOf,
	writeMana,
};
