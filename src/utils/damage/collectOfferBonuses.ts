import type { OfferBonus } from '#types/attackOutcome.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { rulesOfType } from '../actor/actorRules.js';

/** What the attacker's rules add to an attack made through the item with this identifier. */
export function collectOfferBonuses(
	attacker: { rules?: unknown } | null | undefined,
	origin: string | null | undefined,
): OfferBonus[] {
	if (!origin || !isRuleAutomationEnabled()) return [];
	return rulesOfType(attacker, 'offerAttackBonus').flatMap((rule) => {
		const bonus = rule.bonusFor(origin);
		return bonus ? [bonus] : [];
	});
}
