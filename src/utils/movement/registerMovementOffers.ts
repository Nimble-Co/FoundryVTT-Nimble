import { SYSTEM_ID, systemHookName } from '#system';
import type { MovementOffer, MovementRecord } from '#types/movement.js';
import {
	AUTOMATION_SETTING_KEYS,
	isMovementOffersAutomationEnabled,
} from '../../settings/automationSettings.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { lapseMovementOffers } from './movementOffers.js';
import { resolveArmedMovementOffer } from './resolveArmedMovementOffer.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

interface ChangedSetting {
	key?: string;
	value?: unknown;
	config?: { default?: unknown };
}

/** The settings whose change lapses every open Movement Offer. */
const OFFER_GATE_SETTING_KEYS = new Set<string>([
	`${SYSTEM_ID}.${AUTOMATION_SETTING_KEYS.movementOffers}`,
	`${SYSTEM_ID}.${AUTOMATION_SETTING_KEYS.movementTracking}`,
]);

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
 * Lapses every open Movement Offer to a token on the scene, when a combat turn
 * there ends.
 */
export async function lapseOpenMovementOffers(sceneId: string | null): Promise<void> {
	if (!isMovementOffersAutomationEnabled()) return;
	await writeLapsedMovementOffers(
		(offer) => !sceneId || offer.tokenUuid.startsWith(`Scene.${sceneId}.`),
	);
}

/**
 * Lapses every open Movement Offer on every card, whatever the toggles now
 * hold, so an offer stamped under the old setting does not arm a token.
 */
export async function lapseAllOpenMovementOffers(): Promise<void> {
	await writeLapsedMovementOffers(() => true);
}

/**
 * Lapses every open offer when a toggle that gates Movement Offers changes. A
 * world setting is created on its first write, so a created setting that holds
 * its default is no change.
 */
function onOfferGateSettingChanged(setting: ChangedSetting, created: boolean): void {
	if (!setting.key || !OFFER_GATE_SETTING_KEYS.has(setting.key)) return;
	if (created && setting.value === setting.config?.default) return;
	void lapseAllOpenMovementOffers();
}

let didRegister = false;

/**
 * Settles Movement Offers: records one on its card after its token's next
 * Movement, and lapses the open ones when a combat turn ends, the combat is
 * deleted, or a toggle that gates them changes. Idempotent; call from `ready`.
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
	Hooks.on('createSetting', (setting: Setting) => {
		onOfferGateSettingChanged(setting as unknown as ChangedSetting, true);
	});
	Hooks.on('updateSetting', (setting: Setting, changes: Record<string, unknown>) => {
		if ('value' in changes) onOfferGateSettingChanged(setting as unknown as ChangedSetting, false);
	});
}
