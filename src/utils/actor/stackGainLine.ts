import type { CardEvent, StackGainAction } from '#types/cardEvent.d.ts';
import { applyEffectToActor } from '#utils/actor/applyEffectToActor.js';
import { stackGainText } from '#utils/actor/stackGainEvent.js';
import { replaceCardEvent } from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';

interface StackHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
}

interface LineCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

function holderOf(action: StackGainAction): StackHolder | null {
	return fromUuidSync(action.holderUuid as never, { strict: false }) as StackHolder | null;
}

/** The owner of the creature, or a GM, puts a waiting effect on or takes a gained one off. */
export function canActOnStackGain(action: StackGainAction): boolean {
	return mayActHere(action.holderUuid);
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
		text: stackGainText(next, true),
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
