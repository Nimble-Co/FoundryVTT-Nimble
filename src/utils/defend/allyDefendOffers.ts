import { areAllies, areWithinSpaces } from '../tokens/tokenAdjacency.js';
import { type DefendOptionPick, defendOptionsOf, payDefendOption } from './defendOptions.js';
import { damageAppliedTo, defendsOf } from './defendRecords.js';
import { requestDefendAllyUse } from './defendRequests.js';

interface AllyCardLike {
	system?: unknown;
}

/** A button for a hero whose option reacts when an ally Defends. */
export interface AllyDefendOffer {
	key: string;
	defendId: string;
	actor: Actor.Implementation;
	pick: DefendOptionPick;
	defenderName: string;
}

function canvasTokenOf(uuid: string): Token.Implementation | null {
	const document = fromUuidSync(uuid) as TokenDocument | null;
	return (document?.object ?? null) as Token.Implementation | null;
}

/** The ally options the user's heroes can use on this card's Defends, near the hero who Defended. */
export function allyDefendOffers(card: AllyCardLike): AllyDefendOffer[] {
	const applied = damageAppliedTo(card.system);
	const placeables = (canvas?.tokens?.placeables ?? []) as Token.Implementation[];
	const offers: AllyDefendOffer[] = [];
	for (const record of defendsOf(card.system)) {
		if (applied.has(record.tokenUuid)) continue;
		const defender = canvasTokenOf(record.tokenUuid);
		if (!defender) continue;
		for (const token of placeables) {
			const actor = token.actor as Actor.Implementation | null;
			if (!actor?.isOwner || actor.uuid === record.actorUuid || token === defender) continue;
			if (!areAllies(token, defender)) continue;
			for (const pick of defendOptionsOf(actor, card, 'allyDefends')) {
				const used = record.options.some(
					(use) => use.actorUuid === actor.uuid && use.ruleId === pick.rule.id,
				);
				if (used || !areWithinSpaces(token, defender, Math.max(1, pick.rule.range))) continue;
				offers.push({
					key: `${record.id}:${actor.uuid}:${pick.key}`,
					defendId: record.id,
					actor,
					pick,
					defenderName: defender.document.name || defender.actor?.name || '',
				});
			}
		}
	}
	return offers;
}

/** Pay for an ally option and put it on the Defend, with its reminder line. */
export async function useAllyDefendOffer(
	messageId: string,
	offer: AllyDefendOffer,
): Promise<boolean> {
	const use = await payDefendOption(offer.actor, offer.pick);
	if (!use) return false;
	const text = (offer.pick.rule.reminder ?? '').trim();
	return requestDefendAllyUse({
		messageId,
		defendId: offer.defendId,
		use,
		reminder: text ? `${offer.pick.label}: ${text}` : '',
	});
}
