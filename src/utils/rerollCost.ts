import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../settings/automationSettings.js';
import { getActorWoundsValueAndMax } from './actorResources.js';
import {
	hasRuleCharge,
	refundRuleCharge,
	ruleChargesLeft,
	spendRuleCharge,
} from './chargePool/ruleChargeGate.js';
import { findActorCombatant } from './findActorCombatant.js';
import { getHeroicReactionAvailabilityUpdate, type HeroicReactionKey } from './heroicActions.js';
import { spendSpellCost } from './spell/spendSpellCost.js';
import { validateSpellCost } from './spell/validateSpellCost.js';

/** What using a reroll costs. Every part is optional; zero or blank is free. */
interface RerollCost {
	chargePoolIdentifier: string;
	chargeCost: number;
	manaCost: number;
	woundCost: number;
	heroicReaction: HeroicReactionKey | '';
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
		previousActions: number;
	} | null;
}

type RerollPayer = Actor | null | undefined;

interface HeroicReactionCombat {
	id?: string | null;
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	) => Promise<boolean>;
	updateEmbeddedDocuments?: (type: 'Combatant', updates: Record<string, unknown>[]) => unknown;
}

function nothingPaid(): PaidRerollCost {
	return { charges: 0, mana: 0, wounds: 0, heroicReaction: null };
}

function asSpellCostActor(actor: RerollPayer): SpellCostActorLike {
	return actor as unknown as SpellCostActorLike;
}

/** Whether the actor can gain all of `amount` Wounds without going past the maximum. */
function canGainWounds(actor: RerollPayer, amount: number): boolean {
	const wounds = getActorWoundsValueAndMax(actor as Actor.Implementation);
	return !!wounds && wounds.value + amount <= wounds.max;
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
	return cost.woundCost <= 0 || canGainWounds(actor, cost.woundCost);
}

/** Whether paying the cost would change anything on the actor or combat. */
function rerollCostCharges(cost: RerollCost): boolean {
	if (cost.heroicReaction !== '') return true;
	if (!isResourceSpendingAutomationEnabled()) return false;
	return cost.chargePoolIdentifier.trim() !== '' || cost.manaCost > 0 || cost.woundCost > 0;
}

async function spendHeroicReaction(
	actor: RerollPayer,
	key: HeroicReactionKey,
	force: boolean,
): Promise<PaidRerollCost['heroicReaction'] | false> {
	const found = findActorCombatant(actor);
	const combat = found?.combat as unknown as HeroicReactionCombat | undefined;
	if (!found?.combatant.id || !combat?.useHeroicReactions) return null;

	const previousActions = Number(
		foundry.utils.getProperty(found.combatant, 'system.actions.base.current') ?? 0,
	);
	const used = await combat.useHeroicReactions(found.combatant.id, [key], { force });
	if (!used) return false;
	return {
		combatId: combat.id ?? '',
		combatantId: found.combatant.id,
		key,
		previousActions,
	};
}

async function refundHeroicReaction(paid: NonNullable<PaidRerollCost['heroicReaction']>) {
	const combat = game.combat as unknown as HeroicReactionCombat | null;
	if (!combat || (combat.id ?? '') !== paid.combatId) return;
	await combat.updateEmbeddedDocuments?.('Combatant', [
		{
			_id: paid.combatantId,
			'system.actions.base.current': paid.previousActions,
			...getHeroicReactionAvailabilityUpdate(paid.key, true),
		},
	]);
}

/** Give back what `payRerollCost` charged, in reverse order. */
async function refundRerollCost(
	actor: RerollPayer,
	cost: RerollCost,
	paid: PaidRerollCost,
): Promise<void> {
	if (paid.wounds > 0) {
		const wounds = getActorWoundsValueAndMax(actor as Actor.Implementation);
		if (wounds) {
			await actor?.update({
				'system.attributes.wounds.value': Math.max(0, wounds.value - paid.wounds),
			} as Record<string, unknown>);
		}
	}
	if (paid.mana > 0) {
		const current = Number(
			foundry.utils.getProperty(actor ?? {}, 'system.resources.mana.current') ?? 0,
		);
		await actor?.update({
			'system.resources.mana.current': current + paid.mana,
		} as Record<string, unknown>);
	}
	if (paid.charges > 0) await refundRuleCharge(actor, cost.chargePoolIdentifier, paid.charges);
	if (paid.heroicReaction) await refundHeroicReaction(paid.heroicReaction);
}

/**
 * Charge the cost of a reroll: the heroic reaction first, as the part most
 * likely to be refused, then charges, mana and Wounds. When a part fails,
 * the parts already charged are given back and null is returned. With
 * resource spending automation off, only the heroic reaction is spent, as
 * for every other heroic reaction.
 */
async function payRerollCost(
	actor: RerollPayer,
	cost: RerollCost,
	options: { forceHeroicReaction?: boolean } = {},
): Promise<PaidRerollCost | null> {
	const paid = nothingPaid();
	const fail = async () => {
		await refundRerollCost(actor, cost, paid);
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
	}
	if (!isResourceSpendingAutomationEnabled()) return paid;

	if (cost.chargePoolIdentifier.trim()) {
		const amount = Math.max(1, cost.chargeCost);
		if (!(await spendRuleCharge(actor, cost.chargePoolIdentifier, amount))) return fail();
		paid.charges = amount;
	}

	if (cost.manaCost > 0) {
		const outcome = await spendSpellCost(asSpellCostActor(actor), {
			type: 'mana',
			amount: cost.manaCost,
		});
		if (!outcome.ok) return fail();
		paid.mana = cost.manaCost;
	}

	if (cost.woundCost > 0) {
		const wounds = getActorWoundsValueAndMax(actor as Actor.Implementation);
		if (!wounds || wounds.value + cost.woundCost > wounds.max) return fail();
		await actor?.update({
			'system.attributes.wounds.value': wounds.value + cost.woundCost,
		} as Record<string, unknown>);
		paid.wounds = cost.woundCost;
	}

	return paid;
}

export {
	canPayRerollCost,
	payRerollCost,
	refundRerollCost,
	rerollCostCharges,
	rerollUsesLeft,
	type PaidRerollCost,
	type RerollCost,
};
