import type { CardEvent, CardEventText, EventHost, TurnDamageAction } from '#types/cardEvent.d.ts';
import { undoDamageOption } from '#utils/actor/actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from '#utils/actor/actorResources.js';
import { chargeOnLightning } from '#utils/actor/chargedOnLightning.js';
import { giveWounds, takeBackWounds, woundsGiven } from '#utils/actor/giveWounds.js';
import { replaceCardEvent } from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { fireEvent } from '#utils/lastsUntil/lastsUntilEvents.js';
import { requestSaves } from '#utils/saveRequest/saveRequests.js';

const WORDS = 'NIMBLE.chat.turnDamage';
const HP_PATH = 'system.attributes.hp';

/** A creature that takes the damage of a Damage Each Turn rule. */
export interface TurnDamageHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
	system?: unknown;
	applyDamage(amount: number): Promise<unknown>;
	update(data: Record<string, unknown>, options?: object): Promise<unknown>;
}

interface LineCard {
	id?: string | null;
	type?: string;
	flags?: Record<string, unknown>;
}

/** What the damage took from the creature. */
export interface TurnDamageLosses {
	hpLost: number;
	tempLost: number;
	woundsGained: number;
}

function hpOf(holder: TurnDamageHolder): { value: number; temp: number; max: number } {
	const read = (field: string) =>
		Number(foundry.utils.getProperty(holder, `${HP_PATH}.${field}`)) || 0;
	return { value: read('value'), temp: read('temp'), max: read('max') };
}

/** Whether the creature has a Wound track for the rule's Wounds. */
export function hasWoundTrack(holder: TurnDamageHolder): boolean {
	return !!getActorWoundsValueAndMax(holder as never);
}

/** The words of the line: the damage, the Wounds, or both. Null when it gives neither. */
function textOf(
	name: string,
	amount: number,
	damageType: string,
	wounds: number,
): CardEventText | null {
	const types = CONFIG.NIMBLE.damageTypes as Record<string, string>;
	// The lang key, not the CONFIG word: each reader reads the line in their own language.
	const damage: CardEventText = types[damageType]
		? { key: `${WORDS}.typed`, data: { amount, type: { key: `NIMBLE.damageTypes.${damageType}` } } }
		: { key: `${WORDS}.plain`, data: { amount } };
	const woundText: CardEventText = {
		key: wounds === 1 ? 'NIMBLE.chat.wound.one' : 'NIMBLE.chat.wound.many',
		data: { count: wounds },
	};
	if (amount > 0 && wounds > 0) {
		return { key: `${WORDS}.takesAndGains`, data: { name, damage, wounds: woundText } };
	}
	if (amount > 0) return { key: `${WORDS}.takes`, data: { name, damage } };
	if (wounds > 0) return { key: `${WORDS}.gains`, data: { name, wounds: woundText } };
	return null;
}

/** The line for one rule and one creature, or null when it gives nothing. */
export function turnDamageEvent(input: {
	id: string;
	action: TurnDamageAction;
	cause: CardEventText;
	img?: string | null;
	at: number;
}): CardEvent | null {
	const { action } = input;
	const wounds = action.state === 'waiting' ? action.wounds : (action.woundsGained ?? 0);
	const text = textOf(action.holderName, action.amount, action.damageType, wounds);
	if (!text) return null;
	return {
		id: input.id,
		kind: 'damage',
		...(input.img ? { img: input.img } : { icon: 'fa-solid fa-fire-flame-curved' }),
		text,
		cause: input.cause,
		action,
		at: input.at,
	};
}

/**
 * Deals the damage (temp HP first, then HP; not an attack) and gives the Wounds, then what taking
 * damage sets off: the "takes damage" moment, on `host`, and Charged on lightning.
 */
export async function dealTurnDamageTo(
	holder: TurnDamageHolder,
	action: Pick<TurnDamageAction, 'amount' | 'damageType' | 'wounds' | 'sourceUuid'>,
	host: EventHost,
): Promise<TurnDamageLosses> {
	const before = hpOf(holder);
	if (action.amount > 0) await holder.applyDamage(action.amount);
	const after = hpOf(holder);
	const wounds = action.wounds > 0 ? await giveWounds(holder, action.wounds) : null;
	const losses = {
		hpLost: Math.max(0, before.value - after.value),
		tempLost: Math.max(0, before.temp - after.temp),
		woundsGained: woundsGiven(wounds),
	};
	if (losses.hpLost + losses.tempLost > 0) {
		const damageTypes = action.damageType ? [action.damageType] : [];
		fireEvent('takeDamage', holder, { damageTypes }, host);
		await chargeOnLightning(holder as never, damageTypes, action.sourceUuid);
	}
	return losses;
}

function holderOf(action: TurnDamageAction): TurnDamageHolder | null {
	return fromUuidSync(action.holderUuid as never, { strict: false }) as TurnDamageHolder | null;
}

/** The owner of the creature that took it, or a GM, deals a waiting line or undoes a dealt one. */
export function canActOnTurnDamage(action: TurnDamageAction): boolean {
	return mayActHere(action.holderUuid);
}

/** The line with its action changed, and the words that go with it. */
export function turnDamageLineAfter(event: CardEvent, action: TurnDamageAction): CardEvent {
	return (
		turnDamageEvent({
			id: event.id,
			action,
			cause: event.cause ?? { key: '' },
			img: event.img ?? null,
			at: event.at,
		}) ?? { ...event, action }
	);
}

/**
 * Deals a waiting line. The line is marked dealt first, so its Take is not live while the damage
 * goes on, and a failed write deals nothing; the mark holds only while the stored line still
 * waits, so of two at once only one deals. Then the line gets what the damage took, for Undo. A
 * dealing error puts the line back to waiting. Null when the line could not be marked.
 */
export async function dealTurnDamageLine(
	card: LineCard,
	line: CardEvent,
	holder: TurnDamageHolder,
	host: EventHost,
): Promise<TurnDamageLosses | null> {
	const action = line.action as TurnDamageAction;
	const marked = turnDamageLineAfter(line, { ...action, state: 'dealt' });
	if (!(await replaceCardEvent(card as never, line.id, marked, { ifState: 'waiting' }))) {
		return null;
	}
	let losses: TurnDamageLosses;
	try {
		losses = await dealTurnDamageTo(holder, action, host);
	} catch (error) {
		await replaceCardEvent(card as never, line.id, line);
		throw error;
	}
	await replaceCardEvent(
		card as never,
		line.id,
		turnDamageLineAfter(line, { ...action, ...losses, state: 'dealt' }),
	);
	return losses;
}

/** Feature Effects off: a click deals the damage and Wounds of the line. */
export async function takeTurnDamage(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action as TurnDamageAction | undefined;
	if (action?.kind !== 'turnDamage' || action.state !== 'waiting' || !card.id) return false;
	const holder = holderOf(action);
	if (!holder) return false;
	const losses = await dealTurnDamageLine(card, event, holder, { id: card.id });
	if (!losses) return false;
	if (losses.hpLost + losses.tempLost > 0) await requestSaves(card, holder as never, 'takeDamage');
	return true;
}

/** Gives back what the line took: the HP and temp HP it took, and the Wounds it gave. */
export async function undoTurnDamage(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action as TurnDamageAction | undefined;
	if (action?.kind !== 'turnDamage' || action.state !== 'dealt' || !card.id) return false;
	const holder = holderOf(action);
	if (!holder) return false;
	const hp = hpOf(holder);
	const changes: Record<string, unknown> = {};
	if (action.hpLost) changes[`${HP_PATH}.value`] = Math.min(hp.max, hp.value + action.hpLost);
	if (action.tempLost) changes[`${HP_PATH}.temp`] = hp.temp + action.tempLost;
	if (Object.keys(changes).length > 0) await holder.update(changes, undoDamageOption());
	await takeBackWounds(holder, action.woundsGained ?? 0);
	return replaceCardEvent(card as never, event.id, {
		...event,
		action: { ...action, state: 'undone' },
	});
}
