import type { ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import type { CostPayer, UseCost } from '#types/useCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { ACTOR_HP_PATHS, ACTOR_WOUNDS_PATHS } from '../actor/actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from '../actor/actorResources.js';

const RESOURCE_COST_KINDS = [
	'mana',
	'hp',
	'tempHp',
	'wounds',
] as const satisfies readonly ResourceCostKind[];

const ACTOR_MANA_PATH = 'system.resources.mana.current';
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

/** A whole amount of 0 or more; anything that is not a number is 0. */
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

function numberAt(actor: CostPayer, path: string): number {
	return Number(foundry.utils.getProperty(actor ?? {}, path) ?? 0);
}

function manaOf(actor: CostPayer): number {
	return numberAt(actor, ACTOR_MANA_PATH);
}

function woundsOf(actor: CostPayer) {
	return getActorWoundsValueAndMax(actor as Actor.Implementation);
}

/** How many more Wounds the creature can gain before its max. */
function woundRoomOf(actor: CostPayer): number {
	const wounds = woundsOf(actor);
	return wounds ? Math.max(0, wounds.max - wounds.value) : 0;
}

function hpOf(actor: CostPayer): number {
	return numberAt(actor, ACTOR_HP_PATHS.value);
}

function tempHpOf(actor: CostPayer): number {
	return numberAt(actor, ACTOR_TEMP_HP_PATH);
}

interface ResourceKindFacts {
	/** Where the actor keeps the amount. */
	path: string;
	/** What the actor has now at `path`. */
	value: (actor: CostPayer) => number;
	/** A spend adds to the amount (a Wound gained), not takes from it. */
	grows: boolean;
	/** What the creature has, as the notices state it. */
	have: (actor: CostPayer) => number;
	/** The most the creature can spend or sacrifice: HP keeps 1, Wounds stop at the max. */
	available: (actor: CostPayer) => number;
	/** The most a use beyond what the creature has takes: all of it; Wounds have no end. */
	reach: (actor: CostPayer) => number;
	/** The notice when the creature cannot cover the cost. */
	notEnoughKey: string;
}

const RESOURCE_KINDS: Record<ResourceCostKind, ResourceKindFacts> = {
	mana: {
		path: ACTOR_MANA_PATH,
		value: manaOf,
		grows: false,
		have: manaOf,
		available: manaOf,
		reach: (actor) => Math.max(0, manaOf(actor)),
		notEnoughKey: 'NIMBLE.resourceCosts.notEnough',
	},
	hp: {
		path: ACTOR_HP_PATHS.value,
		value: hpOf,
		grows: false,
		have: hpOf,
		available: (actor) => Math.max(0, hpOf(actor) - 1),
		reach: (actor) => Math.max(0, hpOf(actor)),
		notEnoughKey: 'NIMBLE.resourceCosts.notEnoughHp',
	},
	tempHp: {
		path: ACTOR_TEMP_HP_PATH,
		value: tempHpOf,
		grows: false,
		have: tempHpOf,
		available: tempHpOf,
		reach: (actor) => Math.max(0, tempHpOf(actor)),
		notEnoughKey: 'NIMBLE.resourceCosts.notEnough',
	},
	wounds: {
		path: ACTOR_WOUNDS_PATHS.value,
		value: (actor) => woundsOf(actor)?.value ?? 0,
		grows: true,
		have: woundRoomOf,
		available: woundRoomOf,
		reach: () => Number.POSITIVE_INFINITY,
		notEnoughKey: 'NIMBLE.resourceCosts.notEnoughWoundRoom',
	},
};

function resourceKind(kind: ResourceCostKind): ResourceKindFacts {
	return RESOURCE_KINDS[kind];
}

/** Add `amount` of a kind to the creature, or take it away with a negative amount. */
async function changeResource(
	actor: CostPayer,
	kind: ResourceCostKind,
	amount: number,
): Promise<void> {
	const facts = resourceKind(kind);
	await actor?.update({
		[facts.path]: Math.max(0, facts.value(actor) + amount),
	} as Record<string, unknown>);
}

/** Take `amount` of a kind from the creature: spent mana and HP go down, Wounds go up. */
function takeResource(actor: CostPayer, kind: ResourceCostKind, amount: number): Promise<void> {
	return changeResource(actor, kind, resourceKind(kind).grows ? amount : -amount);
}

/** Give back `amount` of a kind that a use took. */
function returnResource(actor: CostPayer, kind: ResourceCostKind, amount: number): Promise<void> {
	return changeResource(actor, kind, resourceKind(kind).grows ? -amount : amount);
}

/** Whether the creature has `amount` of a kind left after `used` of it. */
function hasEnough(actor: CostPayer, kind: ResourceCostKind, amount: number, used = 0): boolean {
	return resourceKind(kind).available(actor) - used >= amount;
}

/** For each cost, the amount of its kind that the costs before it take, by `amountOf`. */
function usedBefore(
	costs: readonly ResourceCost[],
	amountOf: (cost: ResourceCost) => number,
): number[] {
	const totals: Partial<Record<ResourceCostKind, number>> = {};
	return costs.map((cost) => {
		const used = totals[cost.kind] ?? 0;
		totals[cost.kind] = used + amountOf(cost);
		return used;
	});
}

function allowsBeyond(cost: ResourceCost): boolean {
	return cost.beyond !== 'notAllowed';
}

/**
 * Whether a cost allowed beyond what the creature has needs more than it has left after `used`
 * of the kind, so the player must confirm the use. Never with Resource Spending off.
 */
function goesBeyond(actor: CostPayer, cost: ResourceCost, used = 0): boolean {
	if (!isResourceSpendingAutomationEnabled() || !allowsBeyond(cost)) return false;
	const amount = fixedAmountOf(cost);
	return amount !== null && amount > 0 && !hasEnough(actor, cost.kind, amount, used);
}

/** The damage the consequence of a use beyond what the creature has deals. */
function beyondConsequenceDamage(actor: CostPayer, cost: ResourceCost): number {
	if (cost.beyond !== 'halfMaxHpDamage') return 0;
	return Math.floor(Number(foundry.utils.getProperty(actor ?? {}, ACTOR_HP_PATHS.max) ?? 0) / 2);
}

/** Apply the consequence of a use beyond what the creature has. */
async function applyBeyondConsequence(actor: CostPayer, cost: ResourceCost): Promise<void> {
	const damage = beyondConsequenceDamage(actor, cost);
	const target = actor as { applyDamage?: (damage: number) => Promise<void> } | null | undefined;
	if (damage > 0) await target?.applyDamage?.(damage);
}

/**
 * Whether the creature can cover the cost by its lowest amount, after `used` of the kind. With
 * Resource Spending off, every cost can.
 */
function canSpendResource(actor: CostPayer, cost: ResourceCost, used = 0): boolean {
	if (!isResourceSpendingAutomationEnabled()) return true;
	const amount = lowestAmountOf(actor, cost);
	if (amount === null) return false;
	return amount === 0 || allowsBeyond(cost) || hasEnough(actor, cost.kind, amount, used);
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
		? Math.min(max, resourceKind(cost.kind).available(actor))
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
 * creature cannot cover it and nothing was taken. A cost allowed beyond what the
 * creature has takes what there is, down to 0; Wounds go past the max. With
 * Resource Spending off, nothing is taken.
 */
async function spendResource(actor: CostPayer, cost: ResourceCost): Promise<number | null> {
	if (!isResourceSpendingAutomationEnabled()) return 0;
	const needed = fixedAmountOf(cost);
	if (needed === 0) return 0;
	if (needed === null) return null;
	if (!allowsBeyond(cost) && !hasEnough(actor, cost.kind, needed)) return null;
	const amount = Math.min(needed, resourceKind(cost.kind).reach(actor));
	if (amount > 0) await takeResource(actor, cost.kind, amount);
	return amount;
}

export {
	RESOURCE_COST_KINDS,
	applyBeyondConsequence,
	beyondConsequenceDamage,
	canSpendResource,
	fixedAmountOf,
	fixedResourceCost,
	goesBeyond,
	hpOf,
	isRolledCost,
	lowestAmountOf,
	manaOf,
	resourceCostsOf,
	resourceKind,
	returnResource,
	settleResourceCost,
	usedBefore,
	spendResource,
	tempHpOf,
	variableRangeOf,
	wholeAmount,
	woundsOf,
	woundRoomOf,
};
