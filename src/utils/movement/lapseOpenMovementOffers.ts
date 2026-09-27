import type { MovementOffer } from '#types/movement.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { lapseMovementOffers } from './movementOffers.js';

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
 * Lapses every open Movement Offer that `applies` keeps. Runs on the primary
 * active GM, the only client that may write the cards.
 */
async function writeLapsedMovementOffers(
	applies: (offer: MovementOffer) => boolean,
): Promise<void> {
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

	const messages = (game.messages?.contents ?? []) as unknown as OfferBearingMessage[];
	for (const message of messages) {
		const offers = lapseMovementOffers(message.system?.movementOffers ?? [], applies);
		if (offers && message.update) await message.update({ system: { movementOffers: offers } });
	}
}

/**
 * Lapses every open Movement Offer to a token on one of the scenes, when a
 * combat turn there ends.
 */
export async function lapseOpenMovementOffers(sceneIds: ReadonlySet<string>): Promise<void> {
	if (!isMovementOffersAutomationEnabled() || !sceneIds.size) return;
	await writeLapsedMovementOffers((offer) => sceneIds.has(offer.tokenUuid.split('.')[1] ?? ''));
}

/**
 * Lapses every open Movement Offer on every card, whatever the toggles now
 * hold, so an offer stamped under an old setting does not arm a token.
 */
export async function lapseAllOpenMovementOffers(): Promise<void> {
	await writeLapsedMovementOffers(() => true);
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
