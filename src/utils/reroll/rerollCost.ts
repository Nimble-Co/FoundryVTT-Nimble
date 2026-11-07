import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { getActorWoundsValueAndMax } from '../actor/actorResources.js';
import { hasRuleCharge, ruleChargesLeft } from '../chargePool/ruleChargeGate.js';
import { getCombatantCurrentActions } from '../combat/combatTurnActions.js';
import { isCombatStarted } from '../combat/isCombatStarted.js';
import { usedThisTurn } from '../combat/perTurnUse.js';
import { getPools } from '../dicePool/dicePoolSync.js';
import { normalizeIdentifier } from '../dicePool/helpers.js';
import type { DicePoolState } from '../dicePool/types.js';
import type { HeroicReactionKey } from '../incomingReactions/heroicActions.js';
import { validateSpellCost } from '../spell/validateSpellCost.js';

/** What using a reroll costs. Every part is optional; zero or blank is free. */
interface RerollCost {
	chargePoolIdentifier: string;
	chargeCost: number;
	manaCost: number;
	woundCost: number;
	heroicReaction: HeroicReactionKey | '';
	/** Actions a hero spends in combat. Absent is none. */
	actionCost?: number;
	/** The mana, charges and Wounds are per die the player picks. */
	perDie?: boolean;
	/** With no action left the use still goes on, and the card says so. */
	actionReportOnly?: boolean;
	/** The rule can be used once per turn of any creature. */
	turnUseKey?: string;
	/** Every die of this dice pool is expended; it needs at least one. */
	dicePoolIdentifier?: string;
}

/** What was actually charged, so a failed reroll can give it back. */
interface PaidRerollCost {
	charges: number;
	mana: number;
	wounds: number;
	heroicReaction: {
		combatId: string;
		combatantId: string;
		key: HeroicReactionKey;
		actionsSpent: number;
	} | null;
	/** Actions spent: now on the hero's own turn, else from their next turn. */
	action: { combatId: string; combatantId: string; amount: number; now: boolean } | null;
	/** The action cost could not be paid, and the rule only reports that. */
	noActionLeft?: boolean;
	/** A 1/turn use was spent. */
	turnUse?: boolean;
	/** The dice expended from a dice pool. */
	dice?: { poolId: string; faces: number[] } | null;
	/** The combat turn when an action or a heroic reaction was paid. */
	stamp?: TurnStamp | null;
}

/** A combat turn: the combat, the round, and the combatant whose turn it is. */
interface TurnStamp {
	combatId: string;
	round: number;
	combatantId: string;
}

type RerollPayer = Actor | null | undefined;

function asSpellCostActor(actor: RerollPayer): SpellCostActorLike {
	return actor as unknown as SpellCostActorLike;
}

/** The actor's combatant in the started combat, or null outside combat. */
function findActorCombatant(
	actor: Actor | null | undefined,
): { combat: Combat; combatant: Combatant } | null {
	const combat = game.combat ?? null;
	if (!actor || !combat || !isCombatStarted(combat)) return null;
	const combatant = combat.combatants.find(
		(candidate) => candidate.actor === actor || candidate.actor?.uuid === actor.uuid,
	);
	return combatant ? { combat, combatant } : null;
}

function poolToExpend(actor: RerollPayer, cost: RerollCost): DicePoolState | null {
	const identifier = normalizeIdentifier(cost.dicePoolIdentifier);
	if (!identifier) return null;
	return (
		getPools(actor).find((pool) => normalizeIdentifier(pool.identifier) === identifier) ?? null
	);
}

/** Whether the actor can gain all of `amount` Wounds without going past the maximum. */
function canGainWounds(actor: RerollPayer, amount: number): boolean {
	const wounds = getActorWoundsValueAndMax(actor as Actor.Implementation);
	return !!wounds && wounds.value + amount <= wounds.max;
}

function actionCostOf(cost: RerollCost): number {
	return Math.max(0, Math.trunc(Number(cost.actionCost) || 0));
}

/** The hero's combatant and whether it is their turn, or null when no actions can be spent. */
function actionPayer(
	actor: RerollPayer,
): { combat: Combat; combatant: Combatant; now: boolean } | null {
	const found = findActorCombatant(actor);
	if (!found || found.combatant.type !== 'character') return null;
	const now = (found.combat.combatant?.id ?? null) === found.combatant.id;
	return { ...found, now };
}

/** The combat's turn now, or null with no combat. */
function turnStampOf(combat: Combat | null | undefined): TurnStamp | null {
	if (!combat) return null;
	return {
		combatId: combat.id ?? '',
		round: Number(combat.round) || 0,
		combatantId: combat.combatant?.id ?? '',
	};
}

/**
 * Whether Remove keeps an action or a heroic reaction of `paid` spent. They come
 * back only in the turn they were paid in. A record with no stamp keeps them.
 */
function keepsTurnCost(
	paid: Partial<Pick<PaidRerollCost, 'action' | 'heroicReaction' | 'stamp'>>,
): boolean {
	if (!paid.action && !paid.heroicReaction) return false;
	const now = turnStampOf(game.combat);
	const then = paid.stamp;
	return !(
		now &&
		then &&
		now.combatId === then.combatId &&
		now.round === then.round &&
		now.combatantId === then.combatantId
	);
}

/** How many more times the cost's charges pay for it, or null when it uses no charge pool. */
function rerollUsesLeft(actor: RerollPayer, cost: RerollCost): number | null {
	const charges = ruleChargesLeft(actor, cost.chargePoolIdentifier);
	return charges === null ? null : Math.floor(charges / Math.max(1, cost.chargeCost));
}

/**
 * Whether the actor can pay the cost now. A Wound cost needs room below the
 * maximum for every Wound it gives. A heroic reaction is not checked here:
 * the table confirms a spent one on the click. With resource spending
 * automation off, every cost can be paid.
 */
function canPayRerollCost(actor: RerollPayer, cost: RerollCost): boolean {
	if (!isResourceSpendingAutomationEnabled()) return true;
	if (
		cost.chargePoolIdentifier.trim() &&
		!hasRuleCharge(actor, cost.chargePoolIdentifier, cost.chargeCost)
	) {
		return false;
	}
	if (
		cost.manaCost > 0 &&
		!validateSpellCost(asSpellCostActor(actor), { type: 'mana', amount: cost.manaCost }).ok
	) {
		return false;
	}
	if (cost.woundCost > 0 && !canGainWounds(actor, cost.woundCost)) return false;
	if (cost.turnUseKey && usedThisTurn(actor, cost.turnUseKey)) return false;
	if (cost.dicePoolIdentifier?.trim() && !poolToExpend(actor, cost)?.faces.length) return false;
	return cost.actionReportOnly === true || canSpendActions(actor, actionCostOf(cost));
}

/** On the hero's own turn the actions must be there; off it, the next turn has fewer. */
function canSpendActions(actor: RerollPayer, amount: number): boolean {
	if (amount <= 0) return true;
	const payer = actionPayer(actor);
	if (!payer?.now) return true;
	return getCombatantCurrentActions(payer.combatant as Combatant.Implementation) >= amount;
}

/** Whether paying the cost would change anything on the actor or combat. */
function rerollCostCharges(cost: RerollCost): boolean {
	if (cost.heroicReaction !== '') return true;
	if (!isResourceSpendingAutomationEnabled()) return false;
	return (
		cost.chargePoolIdentifier.trim() !== '' ||
		cost.manaCost > 0 ||
		cost.woundCost > 0 ||
		actionCostOf(cost) > 0 ||
		!!cost.turnUseKey ||
		!!cost.dicePoolIdentifier?.trim()
	);
}

/** The cost of a use on this many dice. */
function costForDice(cost: RerollCost, count: number): RerollCost {
	if (!cost.perDie) return cost;
	return {
		...cost,
		manaCost: cost.manaCost * count,
		chargeCost: cost.chargeCost * count,
		woundCost: cost.woundCost * count,
	};
}

/** A cost of one charge of `pool`, and nothing with no pool. */
function chargeOnlyCost(pool = ''): RerollCost {
	return {
		chargePoolIdentifier: pool,
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		actionCost: 0,
	};
}

export {
	actionCostOf,
	actionPayer,
	canSpendActions,
	chargeOnlyCost,
	costForDice,
	canPayRerollCost,
	findActorCombatant,
	keepsTurnCost,
	poolToExpend,
	rerollCostCharges,
	rerollUsesLeft,
	turnStampOf,
	type PaidRerollCost,
	type RerollCost,
};
