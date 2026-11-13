import type { CardEvent, CardEventText, StackGainAction } from '#types/cardEvent.d.ts';
import { applyEffectToActor, type StackReached } from '#utils/actor/applyEffectToActor.js';
import { replaceCardEvent } from '#utils/chat/cardEvents.js';

const WORDS = 'NIMBLE.chat.stackGain';

interface StackHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
}

interface LineCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

function textOf(
	action: Pick<StackGainAction, 'holderName' | 'count' | 'stackedName' | 'gainedName'>,
	gained: boolean,
): CardEventText {
	const data = { name: action.holderName, count: action.count, stacked: action.stackedName };
	if (!gained) return { key: `${WORDS}.has`, data };
	return { key: `${WORDS}.gains`, data: { ...data, effect: action.gainedName } };
}

/**
 * The line of the "At N stacks" count: what the holder gained, with Undo; with Feature Effects
 * off, the count and a button that puts the effect on. With no effect to gain, the count only.
 */
export function stackGainEvent(
	holder: StackHolder,
	reached: StackReached,
	at = Date.now(),
): CardEvent {
	const base = {
		holderName: holder.name ?? '',
		count: reached.count,
		stackedName: reached.stackedName,
		gainedName: reached.gainedName,
	};
	const plate = reached.img ? { img: reached.img } : { icon: 'fa-solid fa-layer-group' };
	const event = { id: `stackGain.${holder.uuid}.${at}`, kind: 'stackGain' as const, ...plate, at };
	if (!reached.gainedUuid && !reached.payload) return { ...event, text: textOf(base, false) };
	const action: StackGainAction = {
		kind: 'stackGain',
		holderUuid: holder.uuid,
		...base,
		...(reached.gainedUuid
			? { state: 'gained', gainedUuid: reached.gainedUuid }
			: { state: 'waiting', payload: reached.payload }),
	};
	return { ...event, text: textOf(base, action.state === 'gained'), action };
}

function holderOf(action: StackGainAction): StackHolder | null {
	return fromUuidSync(action.holderUuid as never, { strict: false }) as StackHolder | null;
}

/** The owner of the creature, or a GM, puts a waiting effect on or takes a gained one off. */
export function canActOnStackGain(action: StackGainAction): boolean {
	return !!game.user?.isGM || !!holderOf(action)?.isOwner;
}

async function gain(card: LineCard, event: CardEvent, action: StackGainAction): Promise<boolean> {
	const holder = holderOf(action);
	if (!holder || !action.payload) return false;
	const applied = await applyEffectToActor(holder as never, action.payload);
	if (!applied) return false;
	const { payload: _payload, ...rest } = action;
	const next: StackGainAction = { ...rest, state: 'gained', gainedUuid: applied.effectUuid };
	return replaceCardEvent(card as never, event.id, {
		...event,
		text: textOf(next, true),
		action: next,
	});
}

async function undo(card: LineCard, event: CardEvent, action: StackGainAction): Promise<boolean> {
	const effect = action.gainedUuid
		? (fromUuidSync(action.gainedUuid as never, { strict: false }) as {
				delete(): Promise<unknown>;
			} | null)
		: null;
	await effect?.delete();
	return replaceCardEvent(card as never, event.id, {
		...event,
		action: { ...action, state: 'undone' },
	});
}

/** A click on the line: a waiting line puts the effect on, a gained one takes it off. */
export function actOnStackGain(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action as StackGainAction | undefined;
	if (action?.kind !== 'stackGain' || !card.id) return Promise.resolve(false);
	if (action.state === 'waiting') return gain(card, event, action);
	if (action.state === 'gained') return undo(card, event, action);
	return Promise.resolve(false);
}
