import { SYSTEM_ID } from '#system';
import type {
	CardEvent,
	CardEventMoment,
	CardEventText,
	CardEventValue,
	EndedEffectRow,
} from '#types/cardEvent.d.ts';
import { keyedQueue } from '#utils/keyedQueue.js';
import { describeLastsUntil, holderReader } from '#utils/lastsUntil/describeLastsUntil.js';
import { endedEffectEvent } from '#utils/lastsUntil/endedEffectEvent.js';
import localize from '#utils/localize.js';

const QUERY_NAME = `${SYSTEM_ID}.cardEvents`;
const MOMENT_CARD_TYPE = 'effectsEnded';
/** How far back in the chat log a moment card is looked for. */
const MOMENT_SEARCH_DEPTH = 20;

interface EventCard {
	id?: string | null;
	type?: string;
	timestamp?: number | null;
	whisper?: readonly (string | null)[];
	flags?: Record<string, unknown>;
	system?: unknown;
	update?(changes: object): Promise<unknown>;
}

export interface MomentEventsOptions {
	/** The users who see the moment card. Empty or missing: everyone. */
	whisper?: string[];
}

type QueryData =
	| { op: 'add'; messageId: string; events: CardEvent[] }
	| {
			op: 'moment';
			moment: CardEventMoment;
			events: CardEvent[];
			options: MomentEventsOptions;
	  };

const queue = keyedQueue();

function storedEvents(card: Pick<EventCard, 'flags'>): CardEvent[] {
	const events = (card.flags?.[SYSTEM_ID] as { events?: unknown } | undefined)?.events;
	return Array.isArray(events) ? (events as CardEvent[]) : [];
}

/** The events of a card, in order. A moment card from before the Events strip shows its rows. */
export function cardEventsOf(
	card: Pick<EventCard, 'type' | 'timestamp' | 'flags' | 'system'>,
): CardEvent[] {
	const events = storedEvents(card);
	if (card.type !== MOMENT_CARD_TYPE) return events;
	const rows = (card.system as { rows?: EndedEffectRow[] } | undefined)?.rows ?? [];
	if (rows.length < 1) return events;
	const at = card.timestamp ?? 0;
	return [...rows.map((row) => endedEffectEvent(row, at)), ...events];
}

function valueText(value: CardEventValue): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	if ('lastsUntil' in value) {
		return describeLastsUntil({
			moments: [value.lastsUntil],
			reader: holderReader(value.source || null),
			localize,
			format: localize,
		});
	}
	return cardEventText(value);
}

/** The text in the language of this client. */
export function cardEventText(text: CardEventText): string {
	if (!text.data) return localize(text.key);
	const data = Object.fromEntries(
		Object.entries(text.data).map(([name, value]) => [name, valueText(value)]),
	);
	return localize(text.key, data);
}

/** The ids of the GMs: who reads a card for the GMs only. */
export function gmReaders(): string[] {
	return (game.users?.filter((user) => user.isGM).map((user) => user.id ?? '') ?? []).filter(
		Boolean,
	);
}

/**
 * Whether the card can show a line. A line for the GMs only needs a card that only GMs read; a
 * card whispered to others shows them a placeholder, so its whisper list is who reads it.
 */
export function canHost(card: EventCard, { gmOnly = false }: { gmOnly?: boolean } = {}): boolean {
	if (!gmOnly) return true;
	const readers = card.whisper ?? [];
	if (readers.length < 1) return false;
	return readers.every((id) => !!id && game.users?.get(id)?.isGM === true);
}

function merged(existing: CardEvent[], added: CardEvent[]): CardEvent[] {
	const ids = new Set(existing.map((event) => event.id));
	const fresh = added.filter((event) => !ids.has(event.id));
	return [...existing, ...fresh].sort((a, b) => a.at - b.at);
}

function appendHere(card: EventCard, events: CardEvent[]): Promise<boolean> {
	return queue.run(`message:${card.id}`, async () => {
		const next = merged(storedEvents(card), events);
		await card.update?.({ [`flags.${SYSTEM_ID}.events`]: next });
		return true;
	});
}

function sameReaders(card: EventCard, whisper: readonly string[]): boolean {
	const readers = new Set(card.whisper ?? []);
	return readers.size === new Set(whisper).size && whisper.every((id) => readers.has(id));
}

function findMomentCard(key: string, whisper: readonly string[]): EventCard | undefined {
	const recent = ((game.messages as unknown as { contents?: EventCard[] })?.contents ?? []).slice(
		-MOMENT_SEARCH_DEPTH,
	);
	for (let index = recent.length - 1; index >= 0; index -= 1) {
		const card = recent[index];
		if (card.type !== MOMENT_CARD_TYPE) continue;
		if ((card.system as { momentKey?: string } | undefined)?.momentKey !== key) continue;
		if (sameReaders(card, whisper)) return card;
	}
	return undefined;
}

function momentHere(
	moment: CardEventMoment,
	events: CardEvent[],
	options: MomentEventsOptions,
): Promise<boolean> {
	const whisper = options.whisper ?? [];
	return queue.run(`moment:${moment.key}`, async () => {
		const found = findMomentCard(moment.key, whisper);
		if (found) return appendHere(found, events);
		const chatData = {
			author: game.user?.id,
			speaker: { alias: game.user?.name ?? '' },
			type: MOMENT_CARD_TYPE,
			system: {
				actorName: game.user?.name ?? '',
				actorType: '',
				image: '',
				permissions: 0,
				rollMode: 0,
				heading: '',
				rows: [],
				momentKey: moment.key,
				momentHeading: moment.heading,
			},
			flags: { [SYSTEM_ID]: { events: merged([], events) } },
			...(whisper.length > 0 ? { whisper } : {}),
		};
		await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return true;
	});
}

async function askGm(data: QueryData): Promise<boolean> {
	const gm = (game.users as unknown as { activeGM?: { query(n: string, d: object): unknown } })
		?.activeGM;
	if (!gm) return false;
	return (await gm.query(QUERY_NAME, data)) === true;
}

/**
 * Add lines to the Events strip of a card. The active GM writes every line, so two writes never
 * race; another client asks it. Lines of one batch go in one update. Resolves false when no GM
 * is online or the write failed.
 */
export async function addCardEvents(card: EventCard, events: CardEvent[]): Promise<boolean> {
	if (events.length < 1 || !card.id) return false;
	try {
		if (game.user?.isActiveGM) return await appendHere(card, events);
		return await askGm({ op: 'add', messageId: card.id, events });
	} catch (error) {
		console.error('Nimble | Could not add the events of a card.', error);
		return false;
	}
}

/**
 * Add lines for a moment with no host card (a turn end, a round end, a timed end). The lines go
 * on the newest recent card of the same moment, or on a new card headed by the moment.
 */
export async function addMomentEvents(
	moment: CardEventMoment,
	events: CardEvent[],
	options: MomentEventsOptions = {},
): Promise<boolean> {
	if (events.length < 1) return false;
	try {
		if (game.user?.isActiveGM) return await momentHere(moment, events, options);
		return await askGm({ op: 'moment', moment, events, options });
	} catch (error) {
		console.error('Nimble | Could not add the events of a moment.', error);
		return false;
	}
}

export function registerCardEventsQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: QueryData) => {
			if (data.op === 'moment') return momentHere(data.moment, data.events, data.options ?? {});
			const card = game.messages?.get(data.messageId) as unknown as EventCard | undefined;
			if (!card) return false;
			return appendHere(card, data.events);
		};
	});
}
