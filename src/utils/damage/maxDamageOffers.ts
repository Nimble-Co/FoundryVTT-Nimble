import type { EffectNode } from '#types/effectTree.js';
import type { MaxDamageChoice, MaxDamageOffer, MaxDamageRuleLike } from '#types/maxDamage.d.ts';
import { actorRules } from '../actor/actorRules.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';

interface OfferActor {
	rules?: unknown;
}

interface OfferItem {
	system?: { activation?: { effects?: unknown[] } };
}

function rulesOf(actor: OfferActor | null | undefined): MaxDamageRuleLike[] {
	return actorRules<MaxDamageRuleLike>(actor).filter((rule) => rule?.type === 'maxDamage');
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
