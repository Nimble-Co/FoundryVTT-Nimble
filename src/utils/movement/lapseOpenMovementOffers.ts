import type { MovementOffer } from '#types/movement.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { lapseMovementOffers, untrackMovementOffers } from './movementOffers.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

export interface OfferCombatScenes {
	scene?: { id?: string | null } | null;
	combatants?: Iterable<{
		sceneId?: string | null;
		token?: { parent?: { id?: string | null } | null } | null;
	}>;
}

/**
 * Writes the offers `close` returns for each card. Runs on the primary active
 * GM, the only client that may write the cards.
 */
async function writeClosedMovementOffers(
	close: (offers: readonly MovementOffer[]) => MovementOffer[] | null,
): Promise<void> {
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

	const messages = (game.messages?.contents ?? []) as unknown as OfferBearingMessage[];
	for (const message of messages) {
		const offers = close(message.system?.movementOffers ?? []);
		if (offers && message.update) await message.update({ system: { movementOffers: offers } });
	}
}

/**
 * Lapses every open Movement Offer to a token on one of the scenes, when a
 * combat turn there ends.
 */
export async function lapseOpenMovementOffers(sceneIds: ReadonlySet<string>): Promise<void> {
	if (!isMovementOffersAutomationEnabled() || !sceneIds.size) return;
	await writeClosedMovementOffers((offers) =>
		lapseMovementOffers(offers, (offer) => sceneIds.has(offer.tokenUuid.split('.')[1] ?? '')),
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
 * The scenes a combat is fought on: its own scene and each combatant's. A
 * combat made from the core tracker has no scene of its own.
 */
export function combatSceneIds(combat: OfferCombatScenes): Set<string> {
	const ids = new Set<string>();
	if (combat.scene?.id) ids.add(combat.scene.id);
	for (const combatant of combat.combatants ?? []) {
		const sceneId = combatant.sceneId ?? combatant.token?.parent?.id;
		if (sceneId) ids.add(sceneId);
	}
	return ids;
}
