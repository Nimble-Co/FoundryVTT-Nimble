import type { EffectNode } from '#types/effectTree.js';
import type { MaxDamageChoice, MaxDamageOffer } from '#types/maxDamage.d.ts';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';

/** Structural view of a `maxDamage` rule, so this module needs no rule import. */
export interface MaxDamageRuleLike {
	type?: string;
	id?: string;
	label?: string;
	use?: 'damage' | 'healing' | 'minionAttack';
	item?: { name?: string; uuid?: string } | null;
	givesCrit?: boolean;
	tempHpChoice?: boolean;
	minionDies?: boolean;
	chargePoolIdentifier?: string;
	chargeCost?: number;
	canPay?: boolean;
	covers?(item: unknown): boolean;
}

interface OfferActor {
	rules?: unknown;
}

interface OfferItem {
	system?: { activation?: { effects?: unknown[] } };
}

function rulesOf(actor: OfferActor | null | undefined): MaxDamageRuleLike[] {
	const rules = actor?.rules;
	if (!rules || typeof (rules as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
	return Array.from(rules as Iterable<MaxDamageRuleLike>).filter(
		(rule) => rule?.type === 'maxDamage',
	);
}

const hasDice = (formula: unknown) => /\d*d\d/.test(String(formula ?? ''));

function rollsFor(item: OfferItem, use: 'damage' | 'healing'): boolean {
	const effects = (item.system?.activation?.effects ?? []) as EffectNode[];
	return flattenEffectsTree(effects).some((node) => {
		const rolled = node as { type: string; formula?: string; deferredRoll?: boolean };
		return rolled.type === use && !rolled.deferredRoll && hasDice(rolled.formula);
	});
}

const keyOf = (rule: MaxDamageRuleLike) => `${rule.item?.uuid ?? ''}:${rule.id ?? ''}`;

/** The Max Damage ticks a roll window of `item` shows, each with its cost. */
export function maxDamageOffers(
	actor: OfferActor | null | undefined,
	item: OfferItem,
): MaxDamageOffer[] {
	return rulesOf(actor).flatMap((rule): MaxDamageOffer[] => {
		const { use } = rule;
		if ((use !== 'damage' && use !== 'healing') || !rollsFor(item, use)) return [];
		if (rule.covers?.(item) !== true) return [];
		const poolIdentifier = rule.chargePoolIdentifier?.trim() ?? '';
		return [
			{
				key: keyOf(rule),
				label: rule.label || rule.item?.name || '',
				use,
				tempHpChoice: use === 'healing' && rule.tempHpChoice === true,
				chargeCost: poolIdentifier ? Number(rule.chargeCost) || 1 : 0,
				canPay: rule.canPay === true,
			},
		];
	});
}

/** The rule of a tick the player picked, when it can still be used on `item`. */
export function maxDamageRuleOf(
	actor: OfferActor | null | undefined,
	item: OfferItem,
	choice: MaxDamageChoice | null | undefined,
): MaxDamageRuleLike | null {
	if (!choice) return null;
	const offer = maxDamageOffers(actor, item).find((each) => each.key === choice.key);
	if (!offer?.canPay) return null;
	return rulesOf(actor).find((rule) => keyOf(rule) === choice.key) ?? null;
}

/** The rule that lets a minion take the max, of the first of these heroes that has one. */
export function minionMaxDamageRule(
	heroes: Iterable<OfferActor | null | undefined>,
): MaxDamageRuleLike | null {
	for (const hero of heroes) {
		const found = rulesOf(hero).find((rule) => rule.use === 'minionAttack' && rule.covers?.({}));
		if (found) return found;
	}
	return null;
}

/**
 * The Max Damage rule a minion can use: one of a hero in the same fight on the
 * minion's side. No data links a minion to the hero who summoned it, so the
 * side stands in for it, and the table only picks a minion that is the hero's.
 */
export function minionMaxDamageRuleFor(
	combat: Combat,
	member: Combatant.Implementation,
): MaxDamageRuleLike | null {
	const side = member.token?.disposition;
	const heroes = Array.from(combat.combatants ?? [])
		.filter(
			(combatant) => combatant.actor?.type === 'character' && combatant.token?.disposition === side,
		)
		.map((combatant) => combatant.actor as never);
	return minionMaxDamageRule(heroes);
}
