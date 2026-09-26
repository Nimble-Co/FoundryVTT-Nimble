import { systemHookName } from '#system';
import type { MovementOffer, MovementRecord } from '#types/movement.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { lapseMovementOffers } from './movementOffers.js';
import { resolveArmedMovementOffer } from './resolveArmedMovementOffer.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Lapses every open Movement Offer to a token on the scene, when a combat turn
 * there ends. Runs on the primary active GM, the only client that may write
 * the cards.
 */
export async function lapseOpenMovementOffers(sceneId: string | null): Promise<void> {
	if (!isMovementOffersAutomationEnabled()) return;
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

	const onScene = (offer: MovementOffer) =>
		!sceneId || offer.tokenUuid.startsWith(`Scene.${sceneId}.`);
	const messages = (game.messages?.contents ?? []) as unknown as OfferBearingMessage[];
	for (const message of messages) {
		const offers = lapseMovementOffers(message.system?.movementOffers ?? [], onScene);
		if (offers && message.update) await message.update({ system: { movementOffers: offers } });
	}
}

let didRegister = false;

/**
 * Settles Movement Offers: records one on its card after its token's next
 * Movement, and lapses the open ones when a combat turn ends or the combat is
 * deleted. Idempotent; call from `ready`.
 */
export function registerMovementOfferListener(): void {
	if (didRegister) return;
	didRegister = true;
	Hooks.on(
		systemHookName('movementFinished') as never,
		((record: MovementRecord) => {
			void resolveArmedMovementOffer(record);
		}) as never,
	);
	Hooks.on('updateCombat', (combat: Combat, changes: Record<string, unknown>) => {
		if (!('turn' in changes) && !('round' in changes)) return;
		void lapseOpenMovementOffers(combat.scene?.id ?? null);
	});
	Hooks.on('deleteCombat', (combat: Combat) => {
		void lapseOpenMovementOffers(combat.scene?.id ?? null);
	});
}
