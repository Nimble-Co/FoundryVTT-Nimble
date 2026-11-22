import { ruleLabel } from '#utils/actor/actorRules.js';
import type { AttackDelivery, AttackSource } from '../damage/attackDelivery.js';
import type { AttackOrigin } from '../damage/attackOrigin.js';
import type { IncomingReactionEntry } from './incomingReactionEntry.js';

const CARD_OFFER_RULE_TYPES = new Set(['diceConsumer', 'chargeConsumer']);

/** What the attack about to be posted looks like, for rules that filter on it. */
export interface CardOfferContext {
	delivery: AttackDelivery;
	/** The item the attack is made with, when it has one. */
	itemUuid?: string | null;
	/** The weapon an ability attacks with. */
	weaponUuid?: string | null;
	/** What the attack is made with. */
	source?: AttackSource;
	/** The stats the attack's formula has. */
	stats?: readonly string[];
	/** The feature the attack was made through. The uuid is there only for an attack made through another item. */
	origin?: Partial<AttackOrigin>;
	/** The upcast steps of the spell. */
	upcastSteps?: number;
}

interface CardOfferRuleLike {
	type?: string;
	id?: string;
	label?: string;
	cardOffer?: 'hit' | 'criticalHit' | null;
	parentDocument?: { name?: string; uuid?: string | null } | null;
	providesCardOffer?: (context?: CardOfferContext) => boolean;
}

/** The minimum an actor must expose to be asked for spend offers. */
export interface OfferingActor {
	uuid?: string;
	rules?: CardOfferRuleLike[];
}

/**
 * Build the spend offers an attacker's own `diceConsumer` and `chargeConsumer`
 * rules extend to the attack card they are about to post, one per opted-in rule.
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
		if (!CARD_OFFER_RULE_TYPES.has(rule?.type ?? '')) continue;
		if (rule.providesCardOffer?.(context) !== true) continue;

		offers.push({
			id: foundry.utils.randomID(),
			kind: 'spendPoolForDamage',
			source: 'rule',
			actorUuid,
			tokenUuid: null,
			targetTokenUuid: null,
			label: ruleLabel(rule),
			ruleId: rule.id ?? '',
			itemUuid: rule.parentDocument?.uuid ?? '',
			used: false,
			outcomeTrigger: rule.cardOffer ?? null,
		});
	}

	return offers;
}
