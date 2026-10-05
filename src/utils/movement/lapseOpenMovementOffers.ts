import type { MovementOffer } from '#types/movement.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { lapseMovementOffers, untrackMovementOffers } from './movementOffers.js';
import { queueMovementOfferWrite } from './queueMovementOfferWrite.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

export interface OfferCombatants {
	combatants?: Iterable<{
		tokenId?: string | null;
		sceneId?: string | null;
		token?: { parent?: { id?: string | null } | null } | null;
	}>;
}

/**
 * Writes the offers `close` returns for each card. Runs on the primary active
 * GM, the only client that may write the cards. Writes are queued, and each
 * reads its card when its turn comes.
 */
function writeClosedMovementOffers(
	close: (offers: readonly MovementOffer[]) => MovementOffer[] | null,
): Promise<void> {
	return queueMovementOfferWrite(async () => {
		if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

		const messages = (game.messages?.contents ?? []) as unknown as OfferBearingMessage[];
		for (const message of messages) {
			const offers = close(message.system?.movementOffers ?? []);
			if (offers && message.update) await message.update({ system: { movementOffers: offers } });
		}
	});
}

/**
 * Lapses every open Movement Offer to one of the tokens, when a turn of the
 * combat they fight in ends. A token that is not in that combat keeps its offer.
 */
export async function lapseOpenMovementOffers(tokenUuids: ReadonlySet<string>): Promise<void> {
	if (!isMovementOffersAutomationEnabled() || !tokenUuids.size) return;
	await writeClosedMovementOffers((offers) =>
		lapseMovementOffers(offers, (offer) => tokenUuids.has(offer.tokenUuid)),
	);
}

/**
 * Untracks every open Movement Offer on every card, whatever the toggles now
 * hold, so an offer stamped under an old setting does not arm a token.
 */
export async function untrackOpenMovementOffers(): Promise<void> {
	await writeClosedMovementOffers(untrackMovementOffers);
}

/**
 * The uuids of the tokens that fight in a combat. A combat made from the core
 * tracker has no scene of its own, so each combatant names its scene.
 */
export function combatTokenUuids(combat: OfferCombatants): Set<string> {
	const uuids = new Set<string>();
	for (const combatant of combat.combatants ?? []) {
		const sceneId = combatant.sceneId ?? combatant.token?.parent?.id;
		if (sceneId && combatant.tokenId) uuids.add(`Scene.${sceneId}.Token.${combatant.tokenId}`);
	}
	return uuids;
}
