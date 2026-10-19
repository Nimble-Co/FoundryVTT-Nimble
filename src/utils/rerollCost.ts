import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import { isResourceSpendingAutomationEnabled } from '../settings/automationSettings.js';
import { getActorWoundsValueAndMax } from './actorResources.js';
import { hasRuleCharge, refundRuleCharge, spendRuleCharge } from './chargePool/ruleChargeGate.js';
import { getHeroicReactionAvailabilityUpdate, type HeroicReactionKey } from './heroicActions.js';
import { isCombatStarted } from './isCombatStarted.js';
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
	combatants: { find(predicate: (combatant: Combatant) => boolean): Combatant | undefined };
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

/** The actor's combatant in a started combat, or null outside combat. */
function findActorCombatant(
	actor: RerollPayer,
): { combat: HeroicReactionCombat; combatant: Combatant } | null {
	const combat = game.combat as unknown as HeroicReactionCombat | null;
	if (!actor || !combat || !isCombatStarted(combat as unknown as Combat)) return null;
	const combatant = combat.combatants.find(
		(candidate) => candidate.actor === actor || candidate.actor?.uuid === actor.uuid,
	);
	return combatant ? { combat, combatant } : null;
}

/**
 * Whether the actor can pay the cost now. A heroic reaction is not checked
 * here: the table confirms a spent one on the click. With resource spending
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
	if (cost.manaCost > 0) {
		return validateSpellCost(asSpellCostActor(actor), { type: 'mana', amount: cost.manaCost }).ok;
	}
	return true;
}

/** Whether paying the cost would change anything on the actor or combat. */
function rerollCostCharges(cost: RerollCost): boolean {
	if (!isResourceSpendingAutomationEnabled()) return false;
	return (
		cost.chargePoolIdentifier.trim() !== '' ||
		cost.manaCost > 0 ||
		cost.woundCost > 0 ||
		cost.heroicReaction !== ''
	);
}

async function spendHeroicReaction(
	actor: RerollPayer,
	key: HeroicReactionKey,
	force: boolean,
): Promise<PaidRerollCost['heroicReaction'] | false> {
	const found = findActorCombatant(actor);
	if (!found?.combatant.id || !found.combat.useHeroicReactions) return null;

	const previousActions = Number(
		foundry.utils.getProperty(found.combatant, 'system.actions.base.current') ?? 0,
	);
	const used = await found.combat.useHeroicReactions(found.combatant.id, [key], { force });
	if (!used) return false;
	return {
		combatId: found.combat.id ?? '',
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
 * resource spending automation off, nothing is charged.
 */
async function payRerollCost(
	actor: RerollPayer,
	cost: RerollCost,
	options: { forceHeroicReaction?: boolean } = {},
): Promise<PaidRerollCost | null> {
	const paid = nothingPaid();
	if (!isResourceSpendingAutomationEnabled()) return paid;

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
		if (wounds) {
			const next = Math.min(wounds.max, wounds.value + cost.woundCost);
			if (next > wounds.value) {
				await actor?.update({ 'system.attributes.wounds.value': next } as Record<string, unknown>);
				paid.wounds = next - wounds.value;
			}
		}
	}

	return paid;
}

export {
	canPayRerollCost,
	findActorCombatant,
	payRerollCost,
	refundRerollCost,
	rerollCostCharges,
	type PaidRerollCost,
	type RerollCost,
};
