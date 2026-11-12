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
import { queueMovementOfferWrite } from '#utils/movement/queueMovementOfferWrite.js';

const QUERY_NAME = `${SYSTEM_ID}.cardEvents`;
const MOMENT_CARD_TYPE = 'effectsEnded';
/** How far back in the chat log a moment card is looked for. */
const MOMENT_SEARCH_DEPTH = 20;

interface EventCard {
	id?: string | null;
	type?: string;
	timestamp?: number | null;
	whisper?: readonly (string | null)[];
	author?: { id?: string | null; isGM?: boolean } | null;
	flags?: Record<string, unknown>;
	system?: unknown;
	update?(changes: object): Promise<unknown>;
}

/** Who reads a card: its whisper list (empty: everyone) and its author, as a document or an id. */
export interface CardReaders {
	whisper?: readonly (string | null)[] | null;
	author?: { id?: string | null } | string | null;
}

interface OwnedCreature {
	name?: string | null;
	testUserPermission?(user: unknown, level: string): boolean;
}

/** A group of lines that go on a card of their own, for the users who act on them. */
export interface UnreadLines {
	users: string[];
	names: string[];
	events: CardEvent[];
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

function creatureAt(uuid: string | null | undefined): OwnedCreature | null {
	if (!uuid) return null;
	const found = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false }) as
		| (OwnedCreature & { actor?: OwnedCreature | null })
		| null;
	if (!found) return null;
	return 'actor' in found ? (found.actor ?? null) : found;
}

/** The creatures whose owners act on a line: the tokens a move is offered to. */
export function lineCreatures(event: CardEvent): OwnedCreature[] {
	const action = event.action;
	if (action?.kind !== 'movementOffer') return [];
	return action.offers
		.map((offer) => creatureAt(offer.tokenUuid))
		.filter((creature): creature is OwnedCreature => !!creature);
}

/** The users who act on a line for these creatures: their owners who are not GMs. */
export function actingUsers(creatures: Iterable<OwnedCreature | null | undefined>): string[] {
	const owned = [...creatures].filter((creature) => !!creature?.testUserPermission);
	if (owned.length < 1) return [];
	const users = Array.from((game.users ?? []) as Iterable<{ id?: string | null; isGM?: boolean }>);
	const ids = new Set<string>();
	for (const creature of owned) {
		for (const user of users) {
			if (!user.id || user.isGM) continue;
			if (creature?.testUserPermission?.(user, 'OWNER')) ids.add(user.id);
		}
	}
	return [...ids];
}

/** Whether each of `users` reads the card: it is public, or whispered to them, or they wrote it. */
export function readByAll(card: CardReaders, users: readonly string[]): boolean {
	const whisper = (card.whisper ?? []).filter((id): id is string => !!id);
	if (whisper.length < 1) return true;
	const author = typeof card.author === 'string' ? card.author : card.author?.id;
	const readers = new Set(author ? [...whisper, author] : whisper);
	return users.every((id) => readers.has(id));
}

/**
 * The lines the card can take, and the lines it cannot: a line that asks a player to act goes on
 * a card that player reads. GMs read every card they need, so they do not count.
 */
export function splitByReaders(
	card: CardReaders,
	events: CardEvent[],
): { here: CardEvent[]; elsewhere: UnreadLines[] } {
	const here: CardEvent[] = [];
	const groups = new Map<string, UnreadLines>();
	for (const event of events) {
		const creatures = lineCreatures(event);
		const users = actingUsers(creatures);
		if (readByAll(card, users)) {
			here.push(event);
			continue;
		}
		const key = [...users].sort().join(',');
		const group = groups.get(key) ?? { users, names: [], events: [] };
		for (const creature of creatures) {
			if (creature.name && !group.names.includes(creature.name)) group.names.push(creature.name);
		}
		group.events.push(event);
		groups.set(key, group);
	}
	return { here, elsewhere: [...groups.values()] };
}

/** Posts the lines that their users could not read, each group on a card for them and the GMs. */
export async function postUnreadLines(groups: readonly UnreadLines[]): Promise<boolean> {
	let placed = true;
	for (const group of groups) {
		const moment: CardEventMoment = {
			key: `once:${foundry.utils.randomID()}`,
			heading: { key: 'NIMBLE.chat.events.forHeading', data: { names: group.names.join(', ') } },
		};
		const whisper = [...new Set([...group.users, ...gmReaders()])];
		placed = (await addMomentEvents(moment, group.events, { whisper })) && placed;
	}
	return placed;
}

/**
 * Whether the card can show a line. A line for the GMs only needs a card that only GMs read; a
 * card whispered to others shows them a placeholder, so its whisper list is who reads it. The
 * author of a whispered card reads it too, so a GM wrote it.
 */
export function canHost(card: EventCard, { gmOnly = false }: { gmOnly?: boolean } = {}): boolean {
	if (!gmOnly) return true;
	const readers = card.whisper ?? [];
	if (readers.length < 1 || card.author?.isGM !== true) return false;
	return readers.every((id) => !!id && game.users?.get(id)?.isGM === true);
}

function merged(existing: CardEvent[], added: CardEvent[]): CardEvent[] {
	const ids = new Set(existing.map((event) => event.id));
	const fresh = added.filter((event) => !ids.has(event.id));
	return [...existing, ...fresh].sort((a, b) => a.at - b.at);
}

/**
 * A line with a move also writes the card's offers, so it runs after the settle and lapse writes
 * of the offers, which run on this client too: it cannot write back an offer they settled.
 */
function appendHere(card: EventCard, events: CardEvent[]): Promise<boolean> {
	return queue.run(`message:${card.id}`, async () => {
		const write = async () => {
			const next = merged(storedEvents(card), events);
			await card.update?.({ [`flags.${SYSTEM_ID}.events`]: next });
			return true;
		};
		const hasMove = events.some((event) => event.action?.kind === 'movementOffer');
		return hasMove ? queueMovementOfferWrite(write) : write();
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
		const { here, elsewhere } = splitByReaders(card, events);
		const moved = elsewhere.length > 0 ? await postUnreadLines(elsewhere) : true;
		if (here.length < 1) return moved;
		const placed = game.user?.isActiveGM
			? await appendHere(card, here)
			: await askGm({ op: 'add', messageId: card.id, events: here });
		return placed && moved;
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
		const { here, elsewhere } = splitByReaders({ whisper: options.whisper }, events);
		const moved = elsewhere.length > 0 ? await postUnreadLines(elsewhere) : true;
		if (here.length < 1) return moved;
		const placed = game.user?.isActiveGM
			? await momentHere(moment, here, options)
			: await askGm({ op: 'moment', moment, events: here, options });
		return placed && moved;
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

/**
 * Lines that a use makes before its card exists, such as the ended line of a Held Change it spends.
 * `postOn` adds them to the card once it is there.
 */
export function pendingCardLines() {
	const lines: CardEvent[] = [];
	return {
		async add(events: CardEvent[]): Promise<boolean> {
			lines.push(...events);
			return true;
		},
		async postOn(card: EventCard | null | undefined): Promise<boolean> {
			if (!card || lines.length < 1) return false;
			return addCardEvents(card, lines.splice(0));
		},
	};
}
