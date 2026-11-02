import type { OfferBonus } from '../../models/rules/offerAttackBonus.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { actorRules } from '../actor/actorRules.js';

interface OfferBonusRuleLike {
	type?: string;
	bonusFor?(offerSource: string | null | undefined): OfferBonus | null;
}

/** What the attacker's rules add to an attack from the offer of this item. */
export function collectOfferBonuses(
	attacker: { rules?: unknown } | null | undefined,
	offerSource: string | null | undefined,
): OfferBonus[] {
	if (!offerSource || !isRuleAutomationEnabled()) return [];
	return actorRules<OfferBonusRuleLike>(attacker).flatMap((rule) => {
		const bonus = rule?.type === 'offerAttackBonus' ? rule.bonusFor?.(offerSource) : null;
		return bonus ? [bonus] : [];
	});
}
