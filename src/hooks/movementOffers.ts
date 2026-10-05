import { SYSTEM_ID, systemHookName } from '#system';
import type { MovementRecord } from '#types/movement.js';
import {
	combatTokenUuids,
	lapseOpenMovementOffers,
	type OfferCombatants,
	untrackOpenMovementOffers,
} from '#utils/movement/lapseOpenMovementOffers.js';
import { forgetArmedMovementOffers } from '#utils/movement/movementOffers.js';
import { resolveArmedMovementOffer } from '#utils/movement/resolveArmedMovementOffer.js';
import { AUTOMATION_SETTING_KEYS } from '../settings/automationSettings.js';

interface TurnState {
	round?: number | null;
	combatantId?: string | null;
}

interface OfferCombat extends OfferCombatants {
	id?: string | null;
	round?: number | null;
	combatant?: { id?: string | null } | null;
	previous?: TurnState;
}

interface ChangedSetting {
	key?: string;
	value?: unknown;
	config?: { default?: unknown };
}

/** The settings whose change untracks every open Movement Offer. */
const OFFER_GATE_SETTING_KEYS = new Set<string>([
	`${SYSTEM_ID}.${AUTOMATION_SETTING_KEYS.movementOffers}`,
	`${SYSTEM_ID}.${AUTOMATION_SETTING_KEYS.movementTracking}`,
]);

/**
 * The round and combatant each combat last held after an update. Foundry's own
 * `previous` also moves when the combatants are re-sorted, so a turn index
 * rewritten for the same combatant would read as a new turn.
 */
const lastTurnStates = new Map<string, TurnState>();

function turnStateOf(combat: OfferCombat): TurnState {
	return { round: combat.round ?? 0, combatantId: combat.combatant?.id ?? null };
}

function recordTurnState(combat: OfferCombat): void {
	if (combat.id) lastTurnStates.set(combat.id, turnStateOf(combat));
}

/**
 * Whether an update to the combat ended a turn: the round or the current
 * combatant changed. A combat that had not started had no turn to end, and a
 * step back undoes a turn rather than ending one. The new turn is recorded
 * either way.
 */
function endsTurn(combat: OfferCombat, direction: number | undefined): boolean {
	const prior = (combat.id ? lastTurnStates.get(combat.id) : undefined) ?? combat.previous;
	const next = turnStateOf(combat);
	recordTurnState(combat);
	if (direction === -1) return false;
	if (!prior) return true;
	const priorRound = prior.round ?? 0;
	if (priorRound === 0) return false;
	return priorRound !== next.round || (prior.combatantId ?? null) !== next.combatantId;
}

/**
 * A world setting is created on its first write, so a created setting that
 * holds its default is no change.
 */
function onOfferGateSettingChanged(setting: ChangedSetting, created: boolean): void {
	if (!setting.key || !OFFER_GATE_SETTING_KEYS.has(setting.key)) return;
	if (created && setting.value === setting.config?.default) return;
	void untrackOpenMovementOffers();
}

let didRegisterIndex = false;

/**
 * Makes each chat message change drop the carried offers read from the chat
 * log. Call at load: a token ruler can read them on the first canvas draw,
 * before `ready`.
 */
export function registerArmedMovementOfferIndex(): void {
	if (didRegisterIndex) return;
	didRegisterIndex = true;
	Hooks.on('createChatMessage', forgetArmedMovementOffers);
	Hooks.on('updateChatMessage', forgetArmedMovementOffers);
	Hooks.on('deleteChatMessage', forgetArmedMovementOffers);
}

let didRegister = false;

/**
 * Settles Movement Offers: records one on its card after its token's next
 * Movement, lapses the open ones of the combatants when a turn of their
 * combat ends or the started combat is deleted, and untracks them when a toggle that gates them changes.
 * Idempotent; call from `ready`.
 */
export default function registerMovementOffers(): void {
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
	Hooks.on(
		'updateCombat',
		(combat: Combat, changes: Record<string, unknown>, options?: { direction?: number }) => {
			if (!('turn' in changes) && !('round' in changes)) return;
			const offerCombat = combat as unknown as OfferCombat;
			if (endsTurn(offerCombat, options?.direction)) {
				void lapseOpenMovementOffers(combatTokenUuids(offerCombat));
			}
		},
	);
	Hooks.on('deleteCombat', (combat: Combat) => {
		const offerCombat = combat as unknown as OfferCombat;
		if (offerCombat.id) lastTurnStates.delete(offerCombat.id);
		// A combat that never started had no turn for its end to cut short.
		if ((offerCombat.round ?? 0) === 0) return;
		void lapseOpenMovementOffers(combatTokenUuids(offerCombat));
	});

	Hooks.on('createSetting', (setting: Setting) => {
		onOfferGateSettingChanged(setting as unknown as ChangedSetting, true);
	});
	Hooks.on('updateSetting', (setting: Setting, changes: Record<string, unknown>) => {
		if ('value' in changes) onOfferGateSettingChanged(setting as unknown as ChangedSetting, false);
	});
}
