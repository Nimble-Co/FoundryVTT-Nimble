import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';
import { queueMovementOfferWrite } from '#utils/movement/queueMovementOfferWrite.js';
import {
	addCardEvents,
	addMomentEvents,
	canHost,
	cardEventsOf,
	cardEventText,
	cardHoldingEvent,
	registerCardEventsQuery,
	replaceCardEvent,
} from '../cardEvents.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

interface TestCard {
	id: string;
	type: string;
	timestamp?: number;
	whisper: string[];
	author?: { isGM?: boolean };
	flags: Record<string, { events?: CardEvent[] }>;
	system: Record<string, unknown>;
	update: Mock<(changes: object) => Promise<void>>;
}

const line = (id: string, at: number): CardEvent => ({
	id,
	kind: 'poolGain',
	icon: 'fa-solid fa-dice',
	text: { key: `text.${id}` },
	at,
});

const idsOf = (events: CardEvent[] | undefined) => (events ?? []).map((event) => event.id);

/** A card whose update lands a tick later, as a database write does. */
function makeCard(id: string, fields: Partial<TestCard> = {}): TestCard {
	const card: TestCard = {
		id,
		type: 'feature',
		whisper: [],
		flags: {},
		system: {},
		update: vi.fn(async (changes: object) => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			const events = (changes as Record<string, CardEvent[]>)[`flags.${SYSTEM_ID}.events`];
			card.flags = { ...card.flags, [SYSTEM_ID]: { events } };
		}),
		...fields,
	};
	return card;
}

let messages: TestCard[];
let create: ReturnType<typeof vi.fn>;
let query: ReturnType<typeof vi.fn>;
let previous: Record<string, unknown>;
let previousCreate: unknown;
let previousQueries: unknown;

beforeEach(() => {
	messages = [];
	query = vi.fn(async () => true);
	create = vi.fn(async (data: Record<string, any>) => {
		const card = makeCard(`m${messages.length}`, {
			type: data.type,
			whisper: data.whisper ?? [],
			flags: data.flags,
			system: data.system,
		});
		messages.push(card);
		return card;
	});
	previous = {
		user: globals.game.user,
		users: globals.game.users,
		messages: globals.game.messages,
	};
	previousCreate = (ChatMessage as unknown as { create?: unknown }).create;
	previousQueries = globals.CONFIG.queries;
	Object.assign(ChatMessage, { create });
	globals.game.user = { id: 'gm', name: 'Gamemaster', isGM: true, isActiveGM: true };
	const users = new Map([
		['gm', { id: 'gm', isGM: true }],
		['gm2', { id: 'gm2', isGM: true }],
		['player', { id: 'player', isGM: false }],
	]);
	globals.game.users = {
		get: (id: string) => users.get(id),
		activeGM: { id: 'gm', query },
	};
	globals.game.messages = {
		get contents() {
			return messages;
		},
		get: (id: string) => messages.find((card) => card.id === id),
	};
});

afterEach(() => {
	Object.assign(globals.game, previous);
	if (previousCreate === undefined) delete (ChatMessage as unknown as { create?: unknown }).create;
	else Object.assign(ChatMessage, { create: previousCreate });
	globals.CONFIG.queries = previousQueries;
	vi.restoreAllMocks();
});

describe('addCardEvents', () => {
	it('on the active GM, adds a batch in one update, in the order the events happened', async () => {
		const card = makeCard('c', { flags: { [SYSTEM_ID]: { events: [line('old', 20)] } } });

		expect(await addCardEvents(card, [line('late', 30), line('early', 10)])).toBe(true);

		expect(card.update).toHaveBeenCalledTimes(1);
		expect(idsOf(card.flags[SYSTEM_ID].events)).toEqual(['early', 'old', 'late']);
	});

	it('two writes to one card at once keep both batches', async () => {
		const card = makeCard('c');

		await Promise.all([addCardEvents(card, [line('a', 1)]), addCardEvents(card, [line('b', 2)])]);

		expect(idsOf(card.flags[SYSTEM_ID].events)).toEqual(['a', 'b']);
	});

	it('a line with an id the card has already is not added twice', async () => {
		const card = makeCard('c', { flags: { [SYSTEM_ID]: { events: [line('a', 1)] } } });

		await addCardEvents(card, [line('a', 1), line('b', 2)]);

		expect(idsOf(card.flags[SYSTEM_ID].events)).toEqual(['a', 'b']);
	});

	it('another client asks the active GM and does not write', async () => {
		globals.game.user = { id: 'player', isGM: false, isActiveGM: false };
		const card = makeCard('c');
		const events = [line('a', 1)];

		expect(await addCardEvents(card, events)).toBe(true);

		expect(query).toHaveBeenCalledWith(`${SYSTEM_ID}.cardEvents`, {
			op: 'add',
			messageId: 'c',
			events,
		});
		expect(card.update).not.toHaveBeenCalled();
	});

	it('with no GM online, nothing is written', async () => {
		globals.game.user = { id: 'player', isGM: false, isActiveGM: false };
		globals.game.users.activeGM = null;

		expect(await addCardEvents(makeCard('c'), [line('a', 1)])).toBe(false);
	});

	it('a failed write is logged, not thrown', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const card = makeCard('c');
		card.update.mockRejectedValueOnce(new Error('locked'));

		expect(await addCardEvents(card, [line('a', 1)])).toBe(false);
		expect(error).toHaveBeenCalled();
	});
});

describe('addCardEvents with a move line', () => {
	const moveLine = (id: string, at: number): CardEvent => ({
		...line(id, at),
		kind: 'movementOffer',
		action: { kind: 'movementOffer', node: { id } as never, offers: [] },
	});

	it('waits for a write of the offers that runs, so it cannot write back an offer it settles', async () => {
		const card = makeCard('host');
		let release = () => {};
		const settle = queueMovementOfferWrite(
			() => new Promise<void>((resolve) => (release = resolve)),
		);

		const written = addCardEvents(card, [moveLine('move', 1)]);
		try {
			await new Promise((resolve) => setTimeout(resolve, 5));
			expect(card.update).not.toHaveBeenCalled();
		} finally {
			release();
		}

		await settle;
		expect(await written).toBe(true);
		expect(idsOf(card.flags[SYSTEM_ID]?.events)).toEqual(['move']);
	});

	it('a line with no move does not wait for the offers', async () => {
		const card = makeCard('host');
		let release = () => {};
		const settle = queueMovementOfferWrite(
			() => new Promise<void>((resolve) => (release = resolve)),
		);

		try {
			expect(await addCardEvents(card, [line('a', 1)])).toBe(true);
		} finally {
			release();
		}
		await settle;
	});
});

describe('a line that asks a player to act', () => {
	const hero = {
		name: 'Tessa',
		testUserPermission: (user: { id: string }) => user.id === 'player',
	};
	const moveFor = (id: string): CardEvent => ({
		...line(id, 1),
		kind: 'movementOffer',
		action: {
			kind: 'movementOffer',
			node: { id } as never,
			offers: [{ tokenUuid: 'Scene.s.Token.tessa' } as never],
		},
	});

	beforeEach(() => {
		const users = [
			{ id: 'gm', isGM: true },
			{ id: 'player', isGM: false },
			{ id: 'other', isGM: false },
		];
		globals.game.users = Object.assign(users, {
			get: (id: string) => users.find((user) => user.id === id),
			activeGM: { id: 'gm', query },
		});
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => {
				if (uuid === 'Scene.s.Token.tessa') return { actor: hero };
				return uuid === 'Actor.tessa' ? hero : null;
			}),
		);
	});

	afterEach(() => vi.unstubAllGlobals());

	const saveFor = (id: string): CardEvent => ({
		...line(id, 1),
		kind: 'saveRequest',
		action: {
			kind: 'saveRequest',
			holderUuid: 'Actor.tessa',
			holderName: 'Tessa',
			effectId: 'conc',
			effectName: 'Concentrating',
			save: 'strength',
			dc: 10,
			state: 'waiting',
		},
	});
	const tempHpFor = (id: string): CardEvent => ({
		...line(id, 1),
		kind: 'tempHpChoice',
		action: {
			kind: 'tempHpChoice',
			holderUuid: 'Actor.tessa',
			holderName: 'Tessa',
			had: 5,
			amount: 3,
			effectUuid: null,
			state: 'waiting',
		},
	});

	it.each([
		['save', saveFor],
		['temp HP choice', tempHpFor],
	])(
		'a %s line goes on a card for its player and the GMs, not on a card for the GM only',
		async (_name, make) => {
			const card = makeCard('attack', { whisper: ['gm'], author: { isGM: true } });

			expect(await addCardEvents(card, [make('ask')])).toBe(true);

			expect(card.update).not.toHaveBeenCalled();
			const [data] = create.mock.calls[0] as [Record<string, any>];
			expect(data.whisper).toEqual(['player', 'gm']);
			expect(idsOf(data.flags[SYSTEM_ID].events)).toEqual(['ask']);
		},
	);

	it('goes on a card for its player and the GMs when the card is whispered to the GM only', async () => {
		const card = makeCard('attack', { whisper: ['gm'], author: { isGM: true } });

		expect(await addCardEvents(card, [moveFor('move')])).toBe(true);

		expect(card.update).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledTimes(1);
		const [data] = create.mock.calls[0] as [Record<string, any>];
		expect(data.whisper).toEqual(['player', 'gm']);
		expect(data.system.momentHeading).toEqual({
			key: 'NIMBLE.chat.events.forHeading',
			data: { names: 'Tessa' },
		});
		expect(idsOf(data.flags[SYSTEM_ID].events)).toEqual(['move']);
	});

	it.each([
		['a public card', []],
		['a card whispered to its player', ['gm', 'player']],
	])('goes on %s', async (_name, whisper) => {
		const card = makeCard('attack', { whisper });

		expect(await addCardEvents(card, [moveFor('move')])).toBe(true);

		expect(create).not.toHaveBeenCalled();
		expect(idsOf(card.flags[SYSTEM_ID]?.events)).toEqual(['move']);
	});

	it('leaves the other lines of the batch on the card', async () => {
		const card = makeCard('attack', { whisper: ['gm'] });

		await addCardEvents(card, [line('a', 1), moveFor('move')]);

		expect(idsOf(card.flags[SYSTEM_ID]?.events)).toEqual(['a']);
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('does not go on a moment card for the GMs only', async () => {
		await addMomentEvents({ key: 'k', heading: { key: 'heading' } }, [moveFor('move')], {
			whisper: ['gm'],
		});

		expect(create).toHaveBeenCalledTimes(1);
		const [data] = create.mock.calls[0] as [Record<string, any>];
		expect(data.whisper).toEqual(['player', 'gm']);
	});
});

describe('replaceCardEvent with a state to match', () => {
	const waiting = (id: string, state = 'waiting'): CardEvent => ({
		...line(id, 1),
		action: { kind: 'turnDamage', state } as never,
	});

	it('replaces the line while it is still in that state', async () => {
		const card = makeCard('c', { flags: { [SYSTEM_ID]: { events: [waiting('a')] } } });

		expect(await replaceCardEvent(card, 'a', waiting('a', 'dealt'), { ifState: 'waiting' })).toBe(
			true,
		);
		expect((card.flags[SYSTEM_ID].events?.[0].action as { state: string }).state).toBe('dealt');
	});

	it('of two marks at once, only the first finds the line in that state', async () => {
		const card = makeCard('c', { flags: { [SYSTEM_ID]: { events: [waiting('a')] } } });

		const results = await Promise.all([
			replaceCardEvent(card, 'a', waiting('a', 'dealt'), { ifState: 'waiting' }),
			replaceCardEvent(card, 'a', waiting('a', 'dealt'), { ifState: 'waiting' }),
		]);

		expect(results).toEqual([true, false]);
		expect(card.update).toHaveBeenCalledTimes(1);
	});

	it('another client sends the state to the active GM', async () => {
		globals.game.user = { id: 'player', isGM: false, isActiveGM: false };
		const card = makeCard('c');
		const next = waiting('a', 'dealt');

		await replaceCardEvent(card, 'a', next, { ifState: 'waiting' });

		expect(query).toHaveBeenCalledWith(`${SYSTEM_ID}.cardEvents`, {
			op: 'replace',
			messageId: 'c',
			eventId: 'a',
			next,
			ifState: 'waiting',
		});
	});
});

describe('cardHoldingEvent', () => {
	it('is the first card when it holds the line', () => {
		const card = makeCard('c', { flags: { [SYSTEM_ID]: { events: [line('a', 1)] } } });
		messages.push(makeCard('other', { flags: { [SYSTEM_ID]: { events: [line('a', 1)] } } }));

		expect(cardHoldingEvent('a', card)).toBe(card);
	});

	it('is the newest recent card that holds the line when the first does not', () => {
		const older = makeCard('older', { flags: { [SYSTEM_ID]: { events: [line('a', 1)] } } });
		const newer = makeCard('newer', { flags: { [SYSTEM_ID]: { events: [line('a', 1)] } } });
		messages.push(older, newer, makeCard('last'));

		expect(cardHoldingEvent('a', makeCard('c'))).toBe(newer);
	});

	it('takes a test of the line id in place of the id', () => {
		const card = makeCard('moved', { flags: { [SYSTEM_ID]: { events: [line('a.1', 1)] } } });
		messages.push(card);

		expect(cardHoldingEvent((id) => id.startsWith('a.'), makeCard('c'))).toBe(card);
	});

	it('is undefined when no recent card holds the line', () => {
		messages.push(makeCard('x'));

		expect(cardHoldingEvent('a', makeCard('c'))).toBeUndefined();
	});
});

describe('the GM query', () => {
	function handler() {
		const once = vi.fn();
		vi.stubGlobal('Hooks', { once });
		globals.CONFIG.queries = {};
		registerCardEventsQuery();
		once.mock.calls[0][1]();
		vi.unstubAllGlobals();
		return globals.CONFIG.queries[`${SYSTEM_ID}.cardEvents`] as (data: object) => Promise<boolean>;
	}

	it('the GM writes the lines a player asked for on that card', async () => {
		const card = makeCard('c');
		messages.push(card);

		expect(await handler()({ op: 'add', messageId: 'c', events: [line('a', 1)] })).toBe(true);

		expect(idsOf(card.flags[SYSTEM_ID].events)).toEqual(['a']);
	});

	it('the GM replaces a line only in the state a player asked for', async () => {
		const dealt = { ...line('a', 1), action: { kind: 'turnDamage', state: 'dealt' } as never };
		const card = makeCard('c', { flags: { [SYSTEM_ID]: { events: [dealt] } } });
		messages.push(card);

		const result = await handler()({
			op: 'replace',
			messageId: 'c',
			eventId: 'a',
			next: line('a', 1),
			ifState: 'waiting',
		});

		expect(result).toBe(false);
		expect(card.update).not.toHaveBeenCalled();
	});

	it('the GM writes the lines of a moment a player asked for', async () => {
		const moment = { key: 'k', heading: { key: 'heading' } };

		await handler()({ op: 'moment', moment, events: [line('a', 1)], options: {} });

		expect(messages).toHaveLength(1);
		expect(idsOf(messages[0].flags[SYSTEM_ID].events)).toEqual(['a']);
	});
});

describe('canHost', () => {
	it('a line for everyone who reads the card goes on any card', () => {
		expect(canHost(makeCard('c', { whisper: ['player'] }))).toBe(true);
	});

	it('a GM-only line goes only on a card that only GMs read', () => {
		expect(canHost(makeCard('c'), { gmOnly: true })).toBe(false);
		expect(canHost(makeCard('c', { whisper: ['gm', 'player'] }), { gmOnly: true })).toBe(false);
		expect(
			canHost(makeCard('c', { whisper: ['gm', 'gm2'], author: { isGM: true } }), { gmOnly: true }),
		).toBe(true);
	});

	it('a GM-only line skips a card that a player wrote, as its author reads it too', () => {
		const card = makeCard('c', { whisper: ['gm', 'gm2'], author: { isGM: false } });
		expect(canHost(card, { gmOnly: true })).toBe(false);
	});
});

describe('addMomentEvents', () => {
	const moment = (key: string) => ({
		key,
		heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnEnd', data: { name: 'Tessa' } },
	});

	it('with no card for the moment, makes one headed by the moment', async () => {
		await addMomentEvents(moment('c1:1:0:turnEnd'), [line('b', 2), line('a', 1)]);

		expect(create).toHaveBeenCalledTimes(1);
		const data = create.mock.calls[0][0];
		expect(data.type).toBe('effectsEnded');
		expect(data.system.momentKey).toBe('c1:1:0:turnEnd');
		expect(data.system.momentHeading).toEqual(moment('').heading);
		expect(idsOf(data.flags[SYSTEM_ID].events)).toEqual(['a', 'b']);
		expect(data.whisper).toBeUndefined();
	});

	it('adds to the card of the same moment, and makes no second card', async () => {
		await addMomentEvents(moment('k'), [line('a', 1)]);
		await addMomentEvents(moment('k'), [line('b', 2)]);

		expect(create).toHaveBeenCalledTimes(1);
		expect(idsOf(messages[0].flags[SYSTEM_ID].events)).toEqual(['a', 'b']);
	});

	it('two writes for one moment at once make one card', async () => {
		await Promise.all([
			addMomentEvents(moment('k'), [line('a', 1)]),
			addMomentEvents(moment('k'), [line('b', 2)]),
		]);

		expect(create).toHaveBeenCalledTimes(1);
		expect(idsOf(messages[0].flags[SYSTEM_ID].events)).toEqual(['a', 'b']);
	});

	it('another moment gets its own card', async () => {
		await addMomentEvents(moment('k1'), [line('a', 1)]);
		await addMomentEvents(moment('k2'), [line('b', 2)]);

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('a card of the moment further back than the last 20 messages is not used', async () => {
		await addMomentEvents(moment('k'), [line('a', 1)]);
		for (let index = 0; index < 20; index += 1) messages.push(makeCard(`x${index}`));

		await addMomentEvents(moment('k'), [line('b', 2)]);

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('a card of the moment for other readers is not used', async () => {
		await addMomentEvents(moment('k'), [line('a', 1)]);
		await addMomentEvents(moment('k'), [line('b', 2)], { whisper: ['gm'] });

		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[1][0].whisper).toEqual(['gm']);
	});

	it('another client asks the active GM', async () => {
		globals.game.user = { id: 'player', isGM: false, isActiveGM: false };

		await addMomentEvents(moment('k'), [line('a', 1)]);

		expect(create).not.toHaveBeenCalled();
		expect(query).toHaveBeenCalledWith(`${SYSTEM_ID}.cardEvents`, {
			op: 'moment',
			moment: moment('k'),
			events: [line('a', 1)],
			options: {},
		});
	});
});

describe('cardEventsOf', () => {
	it('a moment card from before the Events strip gives its rows as lines with Undo, first', () => {
		const row = {
			effectId: 'a',
			holderUuid: 'Actor.goblin',
			holderName: 'Goblin',
			name: 'Blinded',
			img: '',
			sourceName: 'Pocket Sand',
			effect: {},
		};
		const card = makeCard('c', {
			type: 'effectsEnded',
			timestamp: 5,
			system: { heading: 'Start of round 2', rows: [row] },
			flags: { [SYSTEM_ID]: { events: [line('new', 9)] } },
		});

		const events = cardEventsOf(card);

		expect(events.map((event) => event.kind)).toEqual(['effectEnded', 'poolGain']);
		expect(events[0].action).toEqual({ kind: 'undoEnd', row });
		expect(cardEventText(events[0].text)).toBe('Blinded ended on Goblin');
		expect(cardEventText(events[0].cause as never)).toBe('Pocket Sand');
	});

	it('another card has no rows to read', () => {
		expect(cardEventsOf(makeCard('c', { system: { rows: [{}] } }))).toEqual([]);
	});
});

describe('cardEventText', () => {
	it('localizes data values that are lang texts themselves', () => {
		const text = {
			key: 'NIMBLE.chat.events.cause.reasonAndSource',
			data: {
				reason: { key: 'NIMBLE.lastsUntil.chat.heading.turnEnd', data: { name: 'Tessa' } },
				source: 'Rage',
			},
		};

		expect(cardEventText(text)).toBe("End of Tessa's turn - Rage");
	});

	it('reads a Lasts Until moment as the holder of the effect reads it', () => {
		const moment = {
			kind: 'event' as const,
			boundary: null,
			clock: null,
			span: null,
			value: null,
			units: null,
			who: 'holder' as const,
			event: 'attack' as const,
			effectName: '',
		};
		const text = {
			key: 'NIMBLE.chat.events.cause.reasonAndSource',
			data: {
				reason: {
					key: 'NIMBLE.chat.events.cause.lastsUntil',
					data: { moment: { lastsUntil: moment, source: 'Cultist' } },
				},
				source: 'Cultist',
			},
		};

		expect(cardEventText(text)).toBe('Until you attack - Cultist');
	});

	it('a moment of the source names the source', () => {
		const moment = {
			kind: 'event' as const,
			boundary: null,
			clock: null,
			span: null,
			value: null,
			units: null,
			who: 'source' as const,
			event: 'takeDamage' as const,
			effectName: '',
		};

		expect(
			cardEventText({
				key: 'NIMBLE.chat.events.cause.lastsUntil',
				data: { moment: { lastsUntil: moment, source: 'Cultist' } },
			}),
		).toBe('Until Cultist takes damage');
	});
});
