import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import type { CostPayer, PaidUseCost, TurnStamp, UseCost } from '#types/useCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { getActorWoundsValueAndMax } from '../actor/actorResources.js';
import { hasRuleCharge, ruleChargesLeft } from '../chargePool/ruleChargeGate.js';
import { getCombatantCurrentActions } from '../combat/combatTurnActions.js';
import { isCombatStarted } from '../combat/isCombatStarted.js';
import { usedThisTurn } from '../combat/perTurnUse.js';
import { getPools } from '../dicePool/dicePoolSync.js';
import { normalizeIdentifier } from '../dicePool/helpers.js';
import type { DicePoolState } from '../dicePool/types.js';
import { validateSpellCost } from '../spell/validateSpellCost.js';

function asSpellCostActor(actor: CostPayer): SpellCostActorLike {
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

function poolToExpend(actor: CostPayer, cost: UseCost): DicePoolState | null {
	const identifier = normalizeIdentifier(cost.dicePoolIdentifier);
	if (!identifier) return null;
	return (
		getPools(actor).find((pool) => normalizeIdentifier(pool.identifier) === identifier) ?? null
	);
}

/** Whether the actor can gain all of `amount` Wounds without going past the maximum. */
function canGainWounds(actor: CostPayer, amount: number): boolean {
	const wounds = getActorWoundsValueAndMax(actor as Actor.Implementation);
	return !!wounds && wounds.value + amount <= wounds.max;
}

function actionCostOf(cost: UseCost): number {
	return Math.max(0, Math.trunc(Number(cost.actionCost) || 0));
}

/** The hero's combatant and whether it is their turn, or null when no actions can be spent. */
function actionPayer(
	actor: CostPayer,
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
		turn: Number.isInteger(combat.turn) ? combat.turn : null,
	};
}

/** Whether the combatant has more than one turn in a round, as a solo monster does. */
function hasManyTurns(combat: Combat | null | undefined, combatantId: string): boolean {
	const turns = (combat?.turns ?? []) as { id?: string | null }[];
	return turns.filter((turn) => turn?.id === combatantId).length > 1;
}

/**
 * Whether Remove keeps an action or a heroic reaction of `paid` spent. They come
 * back only in the turn they were paid in. A record with no stamp keeps them.
 * A combatant with many turns in a round must also be on the same turn index.
 */
function keepsTurnCost(
	paid: Partial<Pick<PaidUseCost, 'action' | 'heroicReaction' | 'stamp'>>,
): boolean {
	if (!paid.action && !paid.heroicReaction) return false;
	const now = turnStampOf(game.combat);
	const then = paid.stamp;
	return !(
		now &&
		then &&
		now.combatId === then.combatId &&
		now.round === then.round &&
		now.combatantId === then.combatantId &&
		(!hasManyTurns(game.combat, then.combatantId) || now.turn === then.turn)
	);
}

/** How many more times the cost's charges pay for it, or null when it uses no charge pool. */
function costUsesLeft(actor: CostPayer, cost: UseCost): number | null {
	const charges = ruleChargesLeft(actor, cost.chargePoolIdentifier);
	return charges === null ? null : Math.floor(charges / Math.max(1, cost.chargeCost));
}

/**
 * Whether the actor can pay the cost now. A Wound cost needs room below the
 * maximum for every Wound it gives. A heroic reaction is not checked here:
 * the table confirms a spent one on the click. With resource spending
 * automation off, every cost can be paid.
 */
function canPayUseCost(actor: CostPayer, cost: UseCost): boolean {
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
function canSpendActions(actor: CostPayer, amount: number): boolean {
	if (amount <= 0) return true;
	const payer = actionPayer(actor);
	if (!payer?.now) return true;
	return getCombatantCurrentActions(payer.combatant as Combatant.Implementation) >= amount;
}

/** Whether paying the cost would change anything on the actor or combat. */
function useCostCharges(cost: UseCost): boolean {
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
function costForDice(cost: UseCost, count: number): UseCost {
	if (!cost.perDie) return cost;
	return {
		...cost,
		manaCost: cost.manaCost * count,
		chargeCost: cost.chargeCost * count,
		woundCost: cost.woundCost * count,
	};
}

/** A cost of one charge of `pool`, and nothing with no pool. */
function chargeOnlyCost(pool = ''): UseCost {
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
	canPayUseCost,
	findActorCombatant,
	keepsTurnCost,
	poolToExpend,
	useCostCharges,
	costUsesLeft,
	turnStampOf,
};
