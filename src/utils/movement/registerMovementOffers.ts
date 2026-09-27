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
 * Lapses every open Movement Offer to a token on one of the scenes, when a
 * combat turn there ends.
 */
export async function lapseOpenMovementOffers(sceneIds: ReadonlySet<string>): Promise<void> {
	if (!isMovementOffersAutomationEnabled() || !sceneIds.size) return;
	await writeLapsedMovementOffers((offer) => sceneIds.has(offer.tokenUuid.split('.')[1] ?? ''));
}

interface OfferCombat {
	id?: string | null;
	round?: number | null;
	combatant?: { id?: string | null } | null;
	previous?: TurnState;
	scene?: { id?: string | null } | null;
	combatants?: Iterable<{
		sceneId?: string | null;
		token?: { parent?: { id?: string | null } | null } | null;
	}>;
}

interface TurnState {
	round?: number | null;
	combatantId?: string | null;
}

/**
 * The scenes a combat is fought on: its own scene and each combatant's. A
 * combat made from the core tracker has no scene of its own.
 */
export function combatSceneIds(combat: OfferCombat): Set<string> {
	const ids = new Set<string>();
	if (combat.scene?.id) ids.add(combat.scene.id);
	for (const combatant of combat.combatants ?? []) {
		const sceneId = combatant.sceneId ?? combatant.token?.parent?.id;
		if (sceneId) ids.add(sceneId);
	}
	return ids;
}

function turnStateOf(combat: OfferCombat): TurnState {
	return { round: combat.round ?? 0, combatantId: combat.combatant?.id ?? null };
}

/**
 * The round and combatant each combat last held after an update. Foundry's own
 * `previous` also moves when the combatants are re-sorted, so a turn index
 * rewritten for the same combatant would read as a new turn.
 */
const lastTurnStates = new Map<string, TurnState>();

function recordTurnState(combat: OfferCombat): void {
	if (combat.id) lastTurnStates.set(combat.id, turnStateOf(combat));
}

/** Whether an update to the combat ended a turn: the round or the current combatant changed. */
function endsTurn(combat: OfferCombat): boolean {
	const prior = (combat.id ? lastTurnStates.get(combat.id) : undefined) ?? combat.previous;
	const next = turnStateOf(combat);
	recordTurnState(combat);
	if (!prior) return true;
	return (prior.round ?? 0) !== next.round || (prior.combatantId ?? null) !== next.combatantId;
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
	for (const combat of game.combats ?? []) recordTurnState(combat as unknown as OfferCombat);
	Hooks.on('createCombat', (combat: Combat) => {
		recordTurnState(combat as unknown as OfferCombat);
	});
	Hooks.on('updateCombat', (combat: Combat, changes: Record<string, unknown>) => {
		if (!('turn' in changes) && !('round' in changes)) return;
		const offerCombat = combat as unknown as OfferCombat;
		if (endsTurn(offerCombat)) void lapseOpenMovementOffers(combatSceneIds(offerCombat));
	});
	Hooks.on('deleteCombat', (combat: Combat) => {
		const offerCombat = combat as unknown as OfferCombat;
		if (offerCombat.id) lastTurnStates.delete(offerCombat.id);
		void lapseOpenMovementOffers(combatSceneIds(offerCombat));
	});
	Hooks.on('createSetting', (setting: Setting) => {
		onOfferGateSettingChanged(setting as unknown as ChangedSetting, true);
	});
	Hooks.on('updateSetting', (setting: Setting, changes: Record<string, unknown>) => {
		if ('value' in changes) onOfferGateSettingChanged(setting as unknown as ChangedSetting, false);
	});
}
