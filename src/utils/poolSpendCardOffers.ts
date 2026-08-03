import type { AttackDelivery } from './attackDelivery.js';
import type { IncomingReactionEntry } from './incomingReactionEntry.js';

const DICE_CONSUMER_RULE_TYPE = 'diceConsumer';

/** What the attack about to be posted looks like, for rules that filter on it. */
export interface CardOfferContext {
	delivery: AttackDelivery;
}

interface CardOfferRuleLike {
	type?: string;
	id?: string;
	label?: string;
	cardOffer?: 'hit' | 'criticalHit' | null;
	item?: { name?: string; uuid?: string } | null;
	providesCardOffer?: (context?: CardOfferContext) => boolean;
}

/** The minimum an actor must expose to be asked for spend offers. */
export interface OfferingActor {
	uuid?: string;
	rules?: CardOfferRuleLike[];
}

/**
 * Build the spend offers an attacker's own `diceConsumer` rules extend to the
 * attack card they are about to post — one per opted-in rule.
 *
 * These are stamped alongside the defender-side reaction entries and filtered
 * against the resolved outcome before they reach the card, so a `criticalHit`
 * offer never appears on a normal hit. Eligibility (predicate, mode, effect
 * type, attack delivery) is the rule's own call via `providesCardOffer`; the
 * attack context is handed over untouched.
 */
export function collectPoolSpendCardOffers(
	actor: OfferingActor | null | undefined,
	context?: CardOfferContext,
): IncomingReactionEntry[] {
	const actorUuid = actor?.uuid ?? '';
	if (!actorUuid || !Array.isArray(actor?.rules)) return [];

	const offers: IncomingReactionEntry[] = [];

	for (const rule of actor.rules) {
		if (rule?.type !== DICE_CONSUMER_RULE_TYPE) continue;
		if (rule.providesCardOffer?.(context) !== true) continue;

		offers.push({
			id: foundry.utils.randomID(),
			kind: 'spendPoolForDamage',
			source: 'rule',
			actorUuid,
			tokenUuid: null,
			targetTokenUuid: null,
			label: rule.label || rule.item?.name || '',
			ruleId: rule.id ?? '',
			itemUuid: rule.item?.uuid ?? '',
			used: false,
			outcomeTrigger: rule.cardOffer ?? null,
		});
	}

	return offers;
}
