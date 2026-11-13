import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID, systemHookName } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';

const applyEffectFromCard = vi.fn(async () => undefined);

type Globals = Record<string, any>;
const globals = globalThis as Globals;

let NimbleBaseItem: typeof import('../base.svelte.js').NimbleBaseItem;
let openActivationEvents: typeof import('#utils/chat/activationEvents.js').openActivationEvents;

// Setup loads the item through init, so a hoisted vi.mock would miss it.
beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/chat/applyEffectFromCard.js', async (importOriginal) => ({
		...(await importOriginal<typeof import('#utils/chat/applyEffectFromCard.js')>()),
		applyEffectFromCard,
	}));
	({ NimbleBaseItem } = await import('../base.svelte.js'));
	({ openActivationEvents } = await import('#utils/chat/activationEvents.js'));
});

type ActivationCardHost = {
	_createActivationCard(
		chatData: unknown,
		rolls: unknown[],
		activation: { effects?: unknown[] } | null,
		hookContext: Record<string, unknown>,
		use?: unknown,
	): Promise<unknown>;
};

const actor = { uuid: 'Actor.hero', name: 'Hero', statuses: new Set(), effects: [], system: {} };

function itemStub() {
	return Object.assign(Object.create(NimbleBaseItem.prototype), {
		uuid: 'Item.rage',
		name: 'Rage',
		img: 'rage.webp',
		type: 'feature',
		tags: new Set<string>(),
		actor,
		rules: new Map(),
	}) as ActivationCardHost;
}

const free = {
	of: ['action'],
	reason: {
		key: 'NIMBLE.rules.useItemFree.cardLine',
		data: { trigger: { key: 'NIMBLE.rules.useItemFree.reasons.onCritReceived' }, feature: 'Fury' },
	},
	host: { cardId: 'attack' },
};

function chatDataWith(effects: unknown[], targets: string[] = []) {
	return {
		type: 'feature',
		flags: { [SYSTEM_ID]: { itemUuid: 'Item.rage' } },
		system: { targets, activation: { effects } },
	} as Record<string, any>;
}

const line = (id: string): CardEvent => ({
	id,
	kind: 'poolGain',
	icon: 'fa-solid fa-dice',
	text: { key: id },
	at: 1,
});

let host: { id: string; whisper: string[]; flags: object; update: ReturnType<typeof vi.fn> };
let saved: Record<string, unknown>;

beforeEach(() => {
	applyEffectFromCard.mockClear();
	host = { id: 'attack', whisper: [], flags: {}, update: vi.fn(async () => undefined) };
	saved = {
		messages: globals.game.messages,
		isActiveGM: globals.game.user.isActiveGM,
		settings: globals.game.settings,
	};
	globals.game.messages = { get: (id: string) => (id === 'attack' ? host : undefined) };
	globals.game.user.isActiveGM = true;
	globals.game.settings = { get: () => true };
	globals.ChatMessage.create = vi.fn(async () => ({ id: 'use-card', system: {} }));
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	(Hooks.callAll as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
	globals.game.messages = saved.messages;
	globals.game.user.isActiveGM = saved.isActiveGM;
	globals.game.settings = saved.settings;
});

function hostEvents(): CardEvent[] {
	const [changes] = host.update.mock.calls.at(-1) as [Record<string, CardEvent[]>];
	return changes[`flags.${SYSTEM_ID}.events`];
}

describe('the lines of an item use', () => {
	it('go in the create data of the item card, so no other card is posted', async () => {
		const events = openActivationEvents(actor);
		await events?.add([line('pool')]);
		const chatData = chatDataWith([]);

		await itemStub()._createActivationCard(
			chatData,
			[],
			{ effects: [] },
			{},
			{
				events,
				free: null,
				hidden: false,
			},
		);

		expect(globals.ChatMessage.create).toHaveBeenCalledTimes(1);
		expect(chatData.flags[SYSTEM_ID].events).toEqual([line('pool')]);
	});
	it('leave out a move for a player who does not read the card, and post it on a card for them', async () => {
		const users = [
			{ id: 'gm', isGM: true },
			{ id: 'player', isGM: false },
		];
		const savedUsers = globals.game.users;
		globals.game.users = Object.assign(users, {
			get: (id: string) => users.find((u) => u.id === id),
		});
		const hero = {
			name: 'Tessa',
			testUserPermission: (user: { id: string }) => user.id === 'player',
		};
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => (uuid === 'Scene.s.Token.tessa' ? { actor: hero } : null)),
		);
		const move: CardEvent = {
			...line('move'),
			kind: 'movementOffer',
			action: {
				kind: 'movementOffer',
				node: { id: 'move' } as never,
				offers: [{ tokenUuid: 'Scene.s.Token.tessa' } as never],
			},
		};
		try {
			const events = openActivationEvents(actor);
			await events?.add([line('pool'), move]);
			const chatData = Object.assign(chatDataWith([]), { whisper: ['gm'], author: 'gm' });

			await itemStub()._createActivationCard(
				chatData,
				[],
				{ effects: [] },
				{},
				{
					events,
					free: null,
					hidden: true,
				},
			);

			const created = vi.mocked(globals.ChatMessage.create).mock.calls as unknown as [
				Record<string, any>,
			][];
			expect(chatData.flags[SYSTEM_ID].events).toEqual([line('pool')]);
			const forPlayer = created.map(([data]) => data).find((data) => data.type === 'effectsEnded');
			expect(forPlayer?.whisper).toEqual(['player', 'gm']);
			expect(forPlayer?.flags[SYSTEM_ID].events).toEqual([move]);
		} finally {
			globals.game.users = savedUsers;
			vi.unstubAllGlobals();
		}
	});
});

describe('a free use with nothing to click', () => {
	const selfStep = {
		id: 'self',
		type: 'applyEffect',
		recipient: 'self',
		effectId: 'raging',
		parentNode: null,
		parentContext: null,
	};

	it('is one line on its host with the lines of the use, and posts no card', async () => {
		const events = openActivationEvents(actor);
		await events?.add([line('pool')]);

		const card = await itemStub()._createActivationCard(
			chatDataWith([selfStep]),
			[],
			{ effects: [selfStep] },
			{ free },
			{ events, free, hidden: false },
		);

		expect(card).toBeNull();
		expect(globals.ChatMessage.create).not.toHaveBeenCalled();
		const written = hostEvents();
		expect(written.map((event) => event.id)).toContain('pool');
		expect(written.find((event) => event.kind === 'freeUse')).toMatchObject({
			kind: 'freeUse',
			img: 'rage.webp',
			text: { key: 'NIMBLE.chat.events.freeUse.text', data: { name: 'Hero', item: 'Rage' } },
			cause: { key: 'NIMBLE.chat.events.freeUse.cause' },
		});
		expect(applyEffectFromCard).toHaveBeenCalledWith(
			expect.objectContaining({ id: null }),
			expect.objectContaining({ id: 'self' }),
		);
		expect(Hooks.callAll).toHaveBeenCalledWith(
			systemHookName('useItem'),
			expect.anything(),
			null,
			expect.objectContaining({ free }),
		);
	});

	it('hands its host card to the useItem hook, so what the use ends goes on that card', async () => {
		await itemStub()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{ free },
			{ events: null, free, hidden: false },
		);

		expect(Hooks.callAll).toHaveBeenCalledWith(
			systemHookName('useItem'),
			expect.anything(),
			null,
			expect.objectContaining({ eventHost: { id: 'attack' } }),
		);
	});

	it('hands its moment card to the useItem hook, with the key and readers of that card', async () => {
		const moment = {
			key: 'combat1:2:cHero:turnStart',
			heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnStart', data: { name: 'Hero' } },
		};
		const atMoment = { ...free, host: { moment } };

		await itemStub()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{ events: null, free: atMoment, hidden: false },
		);

		expect(Hooks.callAll).toHaveBeenCalledWith(
			systemHookName('useItem'),
			expect.anything(),
			null,
			expect.objectContaining({ eventHost: { moment, whisper: [] } }),
		);
	});

	it('posts its card as before when the card has something to click', async () => {
		const damage = {
			id: 'dmg',
			type: 'damage',
			formula: '1',
			parentNode: null,
			parentContext: null,
		};
		await itemStub()._createActivationCard(
			chatDataWith([damage]),
			[],
			{ effects: [damage] },
			{},
			{
				events: null,
				free,
				hidden: false,
			},
		);

		expect(globals.ChatMessage.create).toHaveBeenCalledTimes(1);
		expect(host.update).not.toHaveBeenCalled();
	});

	it('posts its card when the use is for the GMs only and the host card is public', async () => {
		await itemStub()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{
				events: null,
				free,
				hidden: true,
			},
		);

		expect(globals.ChatMessage.create).toHaveBeenCalledTimes(1);
		expect(host.update).not.toHaveBeenCalled();
	});

	it('posts its card when the use has no host', async () => {
		await itemStub()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{
				events: null,
				free: { ...free, host: undefined },
				hidden: false,
			},
		);

		expect(globals.ChatMessage.create).toHaveBeenCalledTimes(1);
	});
});

describe('a use whose card a rule holds back', () => {
	let created: Record<string, any>[];
	let savedUsers: unknown;

	function heldBackItem() {
		const item = itemStub() as ActivationCardHost & { rules: Map<string, unknown> };
		item.rules = new Map([['hide', { disabled: false, suppressesActivationCard: () => true }]]);
		return item;
	}

	beforeEach(() => {
		created = [];
		savedUsers = globals.game.users;
		globals.game.users = {
			filter: (test: (user: { id: string; isGM: boolean }) => boolean) =>
				[
					{ id: 'gm', isGM: true },
					{ id: 'player', isGM: false },
				].filter(test),
		};
		globals.game.messages = {
			get: () => undefined,
			contents: created,
		};
		globals.ChatMessage.create = vi.fn(async (data: Record<string, any>) => {
			const card: Record<string, any> = {
				...data,
				id: `card${created.length}`,
				update: vi.fn(async (changes: Record<string, unknown>) => {
					card.flags[SYSTEM_ID].events = changes[`flags.${SYSTEM_ID}.events`];
				}),
			};
			created.push(card);
			return card;
		});
	});

	afterEach(() => {
		globals.game.users = savedUsers;
	});

	it('posts its lines on a card of their own, headed by the use', async () => {
		const events = openActivationEvents(actor);
		await events?.add([line('pool')]);

		const card = await heldBackItem()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{ events, free: null, hidden: false },
		);

		expect(card).toBeNull();
		expect(created).toHaveLength(1);
		expect(created[0].system.momentKey).toMatch(/^once:/);
		expect(created[0].system.momentHeading).toEqual({
			key: 'NIMBLE.chat.events.useHeading',
			data: { name: 'Hero', item: 'Rage' },
		});
		expect(created[0].flags[SYSTEM_ID].events).toEqual([line('pool')]);
		expect(created[0]).not.toHaveProperty('whisper');
	});

	it('shows that card to the GMs only when the use was for the GMs only', async () => {
		const events = openActivationEvents(actor);
		await events?.add([line('pool')]);

		await heldBackItem()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{ events, free: null, hidden: true },
		);

		expect(created[0].whisper).toEqual(['gm']);
	});

	it('puts a line that comes after on the same card', async () => {
		const events = openActivationEvents(actor);
		await events?.add([line('pool')]);
		await heldBackItem()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{ events, free: null, hidden: false },
		);

		await events?.add([line('later')]);

		expect(created).toHaveLength(1);
		expect(created[0].flags[SYSTEM_ID].events.map((event: CardEvent) => event.id)).toEqual([
			'pool',
			'later',
		]);
	});

	it('hands that card to the useItem hook, so what the use ends goes on it too', async () => {
		await heldBackItem()._createActivationCard(
			chatDataWith([]),
			[],
			{ effects: [] },
			{},
			{ events: openActivationEvents(actor), free: null, hidden: true },
		);

		expect(Hooks.callAll).toHaveBeenCalledWith(
			systemHookName('useItem'),
			expect.anything(),
			null,
			expect.objectContaining({
				eventHost: {
					moment: expect.objectContaining({ key: expect.stringMatching(/^once:/) }),
					whisper: ['gm'],
				},
			}),
		);
	});
});
