import type { OfferBonus } from '#types/attackOutcome.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { type AttackOrigin, rulesReachingAttack } from './attackOrigin.js';

/** What the rules that reach an attack add to it because of the item it was made through. */
export function collectOfferBonuses(
	attacker: { rules?: unknown } | null | undefined,
	origin: Partial<AttackOrigin> | null | undefined,
): OfferBonus[] {
	if (!origin?.identifier || !isRuleAutomationEnabled()) return [];
	return rulesReachingAttack(attacker, 'offerAttackBonus', origin).flatMap((rule) => {
		const bonus = rule.bonusFor(origin.identifier);
		return bonus ? [bonus] : [];
	});
}
