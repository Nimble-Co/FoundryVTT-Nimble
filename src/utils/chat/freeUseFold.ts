import type {
	CardEvent,
	CardEventText,
	CardEventValue,
	EventHost,
	EventHostCard,
	EventSink,
	FreeUseHost,
} from '#types/cardEvent.d.ts';
import type { EffectNode, PoolNode } from '#types/effectTree.js';
import { facesText } from '#utils/dicePool/poolEvents.js';
import { cardSchemaHas } from '#utils/documents/cardSchemaHas.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { cardEventId } from './activationEvents.js';
import { addCardEvents, addMomentEvents, canHost, gmReaders } from './cardEvents.js';
import type { FreeUseReason } from './freeUseReason.js';

const WORDS = 'NIMBLE.chat.events.freeUse';

interface UseCardSystem {
	targets?: string[];
	activation?: {
		effects?: EffectNode[];
		acquireTargetsFromTemplate?: boolean;
		template?: { shape?: string | null };
	} | null;
}

/** A step a reader can click, a note to read, or a move a token carries: the card must be there. */
function needsTheCard(node: EffectNode): boolean {
	switch (node.type) {
		case 'damage':
		case 'damageOutcome':
		case 'healing':
		case 'savingThrow':
		case 'move':
			return true;
		case 'applyEffect':
		case 'endConditions':
		case 'wound':
			return node.recipient !== 'self';
		case 'note':
			return !!node.text?.trim();
		default:
			return false;
	}
}

/**
 * Whether the card of a use would have something to click or read: a target, a damage, healing or
 * save step, an Apply Effect, Wound or End Conditions step for targets, a move, a note, or an area
 * to place. Self Apply Effect, Wound and End Conditions steps and pool steps need no card.
 */
export function useCardHasSomethingToClick(system: UseCardSystem | null | undefined): boolean {
	if ((system?.targets?.length ?? 0) > 0) return true;
	const activation = system?.activation;
	if (activation?.acquireTargetsFromTemplate && activation.template?.shape) return true;
	return flattenEffectsTree(activation?.effects ?? []).some(needsTheCard);
}

function poolResult(node: PoolNode): CardEventText | null {
	const result = node.result;
	if (!result?.applied) return null;
	const pool = result.poolLabel || node.poolIdentifier;
	if (node.poolType === 'dice') {
		const faces = result.faces ?? [];
		if (faces.length < 1) return { key: `${WORDS}.poolEmpty`, data: { pool } };
		return { key: `${WORDS}.poolNow`, data: { pool, value: facesText(faces) } };
	}
	return { key: `${WORDS}.poolNow`, data: { pool, value: result.newCount ?? 0 } };
}

/** What the use left, as the line shows it: the pools it changed. Null when it changed none. */
export function useResults(effects: EffectNode[] | undefined): CardEventText | null {
	const results = flattenEffectsTree(effects ?? [])
		.filter((node): node is PoolNode => node.type === 'pool')
		.map(poolResult)
		.filter((text): text is CardEventText => !!text);
	if (results.length < 1) return null;
	return results.reduce((first, second) => ({
		key: `${WORDS}.results`,
		data: { first, second },
	}));
}

function reasonText(reason: FreeUseReason): CardEventText {
	return { key: reason.key, data: reason.data as Record<string, CardEventValue> | undefined };
}

/** Why the use was free: the trigger and the feature, when the reason names them. */
function causeOf(reason: FreeUseReason): CardEventText {
	const data = reason.data ?? {};
	if (data.trigger && data.feature) {
		return {
			key: `${WORDS}.cause`,
			data: { trigger: data.trigger as CardEventValue, feature: data.feature as CardEventValue },
		};
	}
	return reasonText(reason);
}

export interface FreeUseLineInput {
	actorName: string;
	item: { name?: string | null; img?: string | null };
	reason: FreeUseReason;
	effects?: EffectNode[];
}

/** The one line of a free use whose card would have nothing to click. */
export function freeUseEvent(input: FreeUseLineInput): CardEvent {
	const cause = causeOf(input.reason);
	const results = useResults(input.effects);
	return {
		id: cardEventId('freeUse'),
		kind: 'freeUse',
		...(input.item.img ? { img: input.item.img } : { icon: 'fa-solid fa-forward' }),
		text: {
			key: `${WORDS}.text`,
			data: { name: input.actorName, item: input.item.name ?? '' },
		},
		cause: results ? { key: `${WORDS}.causeWithResults`, data: { cause, results } } : cause,
		at: Date.now(),
	};
}

function hasOfferLine(events: CardEvent[]): boolean {
	return events.some((event) => event.action?.kind === 'movementOffer');
}

/**
 * Where the lines of a free use go: the host card, or the card of the host moment. Null when the
 * host card is gone or cannot show a line for the GMs only. A line with a move needs a card that
 * stores offers.
 */
export function freeUseSink(host: FreeUseHost, { gmOnly }: { gmOnly: boolean }): EventSink | null {
	if ('cardId' in host) {
		const card = game.messages?.get(host.cardId) as unknown as EventHostCard | undefined;
		if (!card || !canHost(card, { gmOnly })) return null;
		if (!gmOnly && (card.whisper?.length ?? 0) > 0) return null;
		return async (events) => {
			if (hasOfferLine(events) && !cardSchemaHas(card.type, 'movementOffers')) return false;
			return addCardEvents(card, events);
		};
	}
	const whisper = gmOnly ? gmReaders() : [];
	return (events) => addMomentEvents(host.moment, events, { whisper });
}

/** Where the other lines of a folded free use go: the card that took its line. */
export function freeUseEventHost(host: FreeUseHost, { gmOnly }: { gmOnly: boolean }): EventHost {
	if ('cardId' in host) return { id: host.cardId };
	return { moment: host.moment, whisper: gmOnly ? gmReaders() : [] };
}
