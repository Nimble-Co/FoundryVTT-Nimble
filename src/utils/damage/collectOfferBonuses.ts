import type { OfferBonus } from '#types/attackOutcome.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { rulesOfType } from '../actor/actorRules.js';

/** What the attacker's rules add to an attack from the offer of this item. */
export function collectOfferBonuses(
	attacker: { rules?: unknown } | null | undefined,
	offerSource: string | null | undefined,
): OfferBonus[] {
	if (!offerSource || !isRuleAutomationEnabled()) return [];
	return rulesOfType(attacker, 'offerAttackBonus').flatMap((rule) => {
		const bonus = rule.bonusFor(offerSource);
		return bonus ? [bonus] : [];
	});
}
