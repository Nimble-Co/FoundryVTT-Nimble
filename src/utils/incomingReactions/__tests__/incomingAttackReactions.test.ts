import { beforeEach, describe, expect, it, vi } from 'vitest';

type ReactionModule = typeof import('../incomingAttackReactions.js') &
	typeof import('#utils/chat/cardOperations.js') &
	typeof import('../../reroll/broadcastRerollRolling.js');

interface MockMessage {
	system: { incomingReactions: Array<{ id: string; kind: string }> };
	resolveRedirectReaction: ReturnType<typeof vi.fn>;
	cardRerolls: {
		resolveRerollReaction: ReturnType<typeof vi.fn>;
		resolveKeepChoice: ReturnType<typeof vi.fn>;
		resolveResultRemoval: ReturnType<typeof vi.fn>;
	};
	cardDamageBack: { resolve: ReturnType<typeof vi.fn> };
}

type TestGlobals = {
	game: {
		user: { id: string | null; isGM: boolean } | null;
		users: {
			activeGM: { id: string } | null;
			contents: Array<{ id: string; isGM: boolean; active: boolean }>;
		};
		socket: { on?: ReturnType<typeof vi.fn>; emit?: ReturnType<typeof vi.fn> };
		messages: { get: ReturnType<typeof vi.fn> };
	};
	ui: { notifications: { warn: ReturnType<typeof vi.fn> } };
	Hooks: { callAll: ReturnType<typeof vi.fn> };
};

function globals(): TestGlobals {
	return globalThis as unknown as TestGlobals;
}

function createMessage(entries: Array<{ id: string; kind: string }>): MockMessage {
	return {
		system: { incomingReactions: entries },
		resolveRedirectReaction: vi.fn().mockResolvedValue(undefined),
		cardRerolls: {
			resolveRerollReaction: vi.fn().mockResolvedValue(undefined),
			resolveKeepChoice: vi.fn().mockResolvedValue(undefined),
			resolveResultRemoval: vi.fn().mockResolvedValue(undefined),
		},
		cardDamageBack: { resolve: vi.fn().mockResolvedValue(undefined) },
	};
}

function setUser(user: { id: string | null; isGM: boolean } | null): void {
	globals().game.user = user;
}

function setActiveGm(id: string | null): void {
	globals().game.users = {
		activeGM: id ? { id } : null,
		contents: id ? [{ id, isGM: true, active: true }] : [],
	};
}

function setMessages(messagesById: Record<string, MockMessage>): void {
	globals().game.messages = {
		get: vi.fn((id: string) => messagesById[id] ?? null),
	};
}

// cardOperations keeps a "listener already registered" flag and the operations
// map at module scope, so every test needs fresh instances of both modules: the
// operations then register on the fresh map, and the listener on this socket spy.
async function loadModule(): Promise<ReactionModule> {
	vi.resetModules();
	const cardOperations = await import('#utils/chat/cardOperations.js');
	const reactions = await import('../incomingAttackReactions.js');
	const rolling = await import('../../reroll/broadcastRerollRolling.js');
	return { ...cardOperations, ...reactions, ...rolling };
}

beforeEach(() => {
	vi.clearAllMocks();
	setActiveGm('gm-user');
	setMessages({});
	globals().game.socket = { on: vi.fn(), emit: vi.fn() };
	globals().ui = { notifications: { warn: vi.fn() } };
	globals().Hooks = { callAll: vi.fn() };
});

describe('requestIncomingAttackReaction', () => {
	it('executes the reaction directly for a GM user without emitting a socket request', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(true);

		expect(message.cardRerolls.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'gm-user',
			false,
			false,
			{},
		);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('carries the picked stat to the reroll, also through the socket', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			pick: { stat: 'dexterity' },
		});

		expect(message.cardRerolls.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'gm-user',
			false,
			false,
			{
				stat: 'dexterity',
			},
		);

		setUser({ id: 'player-1', isGM: false });
		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			pick: { stat: 'will' },
		});
		expect(globals().game.socket.emit).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ pick: { stat: 'will' } }),
		);
	});

	it('does nothing, and does not throw, for a legacy forceReroll entry', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(true);

		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
		expect(message.resolveRedirectReaction).not.toHaveBeenCalled();
	});

	it('routes a redirectToSelf entry to resolveRedirectReaction for a GM user', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'redirectToSelf' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' });

		expect(message.resolveRedirectReaction).toHaveBeenCalledWith('entry-1', 'gm-user', false);
		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('routes a reroll entry to resolveRerollReaction with the heroic reaction answer', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			forceHeroicReaction: true,
		});

		expect(message.cardRerolls.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'gm-user',
			false,
			true,
			{},
		);
	});

	it("sends a player's picked die to the GM", async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		setUser({ id: 'player-1', isGM: false });

		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			pick: { die: { term: 0, result: 1 } },
		});

		expect(globals().game.socket.emit).toHaveBeenCalledWith(
			'system.nimble',
			expect.objectContaining({ pick: { die: { term: 0, result: 1 } } }),
		);
	});

	it('sends the face a player set a die to to the GM', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		setUser({ id: 'player-1', isGM: false });

		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			pick: { value: 8 },
		});

		expect(globals().game.socket.emit).toHaveBeenCalledWith(
			'system.nimble',
			expect.objectContaining({ pick: { value: 8 } }),
		);
	});

	it('sends the heroic reaction answer of a player reroll to the GM', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		setUser({ id: 'player-1', isGM: false });

		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			forceHeroicReaction: true,
		});

		expect(globals().game.socket.emit).toHaveBeenCalledWith('system.nimble', {
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
			forceHeroicReaction: true,
		});
	});

	it('emits a socket request with the expected payload for a non-GM user', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'player-1', isGM: false });

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(true);

		expect(globals().game.socket.emit).toHaveBeenCalledWith('system.nimble', {
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('returns false for a non-GM user when no GM is active', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		setUser({ id: 'player-1', isGM: false });
		setActiveGm(null);

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(false);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('returns false when there is no logged-in user', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		setUser(null);

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(false);
	});
});

describe('registerCardSocketListener', () => {
	async function registerAndGetListener(): Promise<(payload: unknown) => void> {
		const { registerCardSocketListener } = await loadModule();
		registerCardSocketListener();

		const socketOn = globals().game.socket.on;
		expect(socketOn).toHaveBeenCalledWith('system.nimble', expect.any(Function));
		return socketOn?.mock.calls[0]?.[1] as (payload: unknown) => void;
	}

	async function flushAsync(): Promise<void> {
		await Promise.resolve();
		await Promise.resolve();
	}

	it('refuses a relayed request for a legacy forceReroll entry', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		expect(() =>
			listener({
				type: 'incomingAttackReaction',
				messageId: 'message-1',
				entryId: 'entry-1',
				userId: 'player-1',
			}),
		).not.toThrow();
		await flushAsync();

		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
		expect(message.resolveRedirectReaction).not.toHaveBeenCalled();
	});

	it('routes a relayed reroll request to resolveRerollReaction', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.cardRerolls.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'player-1',
			true,
			false,
			{
				die: null,
				value: null,
				stat: null,
				dice: null,
			},
		);
	});

	it('gives the GM the die a player picked, and drops a pick that is not a die', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();
		const request = (die: unknown) => ({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
			pick: { die },
		});

		listener(request({ term: 2, result: 0 }));
		listener(request({ term: -1, result: 0 }));
		listener(request({ term: '2', result: 0 }));
		await flushAsync();

		const dice = message.cardRerolls.resolveRerollReaction.mock.calls.map((call) => call[4].die);
		expect(dice).toEqual([{ term: 2, result: 0 }, null, null]);
	});

	it('gives the GM the face a player set a die to, and drops one that is not a face', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();
		const request = (value: unknown) => ({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
			pick: { value },
		});

		listener(request(7));
		listener(request(0));
		listener(request(2.5));
		listener(request('7'));
		await flushAsync();

		const faces = message.cardRerolls.resolveRerollReaction.mock.calls.map((call) => call[4].value);
		expect(faces).toEqual([7, null, null, null]);
	});

	it('routes redirectToSelf entries to resolveRedirectReaction', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'redirectToSelf' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.resolveRedirectReaction).toHaveBeenCalledWith('entry-1', 'player-1', true);
		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('ignores requests of a different type', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'advanceCombatTurn',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
		expect(message.resolveRedirectReaction).not.toHaveBeenCalled();
	});

	it('ignores requests on non-GM clients', async () => {
		setUser({ id: 'player-2', isGM: false });
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('only executes on the primary active GM client', async () => {
		setUser({ id: 'secondary-gm', isGM: true });
		setActiveGm('gm-user');
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('ignores malformed payloads missing required fields', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'reroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({ type: 'incomingAttackReaction', messageId: 'message-1' });
		listener(null);
		listener('not-an-object');
		await flushAsync();

		expect(message.cardRerolls.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('registers the socket listener only once per module instance', async () => {
		const { registerCardSocketListener } = await loadModule();
		registerCardSocketListener();
		registerCardSocketListener();

		expect(globals().game.socket.on).toHaveBeenCalledTimes(1);
	});

	it('delivers a rejection addressed to this client, GM or not', async () => {
		setUser({ id: 'player-1', isGM: false });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReactionRejected',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
			reasonKey: 'NIMBLE.chat.incomingReactions.poolSpendStale',
		});

		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
		expect(globals().Hooks.callAll).toHaveBeenCalledWith(
			'nimble.incomingReactionRejected',
			expect.objectContaining({ entryId: 'entry-1' }),
		);
	});

	it('ignores a rejection addressed to someone else', async () => {
		setUser({ id: 'player-2', isGM: false });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReactionRejected',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
			reasonKey: 'NIMBLE.chat.incomingReactions.poolSpendStale',
		});

		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
		expect(globals().Hooks.callAll).not.toHaveBeenCalled();
	});
});

describe('the rolling reroll die', () => {
	const D20 = { slot: 'check', faces: 20 };

	async function rollingOf(messageId: string) {
		const { rollingRerollOf } = await import('../../reroll/rerollRolling.svelte.js');
		return rollingRerollOf(messageId);
	}

	it('shows on this client and tells every other client', async () => {
		const { broadcastRerollRolling } = await loadModule();

		broadcastRerollRolling('message-1', D20);

		expect(await rollingOf('message-1')).toEqual(D20);
		expect(globals().game.socket.emit).toHaveBeenCalledWith('system.nimble', {
			type: 'rerollRolling',
			messageId: 'message-1',
			roll: D20,
		});
	});

	it('stops on this client and every other client', async () => {
		const { broadcastRerollRolling } = await loadModule();
		broadcastRerollRolling('message-1', D20);

		broadcastRerollRolling('message-1', null);

		expect(await rollingOf('message-1')).toBeNull();
		expect(globals().game.socket.emit).toHaveBeenLastCalledWith('system.nimble', {
			type: 'rerollRolling',
			messageId: 'message-1',
			roll: null,
		});
	});

	it('shows the die another client threw, on any client', async () => {
		setUser({ id: 'player-1', isGM: false });
		const { registerCardSocketListener } = await loadModule();
		registerCardSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;

		listener({ type: 'rerollRolling', messageId: 'message-1', roll: D20 });
		expect(await rollingOf('message-1')).toEqual(D20);

		listener({ type: 'rerollRolling', messageId: 'message-1', roll: null });
		expect(await rollingOf('message-1')).toBeNull();
	});

	it.each([
		{ messageId: '', roll: D20 },
		{ messageId: 'message-1', roll: { slot: 'check' } },
		{ messageId: 'message-1', roll: { slot: 7, faces: 20 } },
	])('ignores a malformed signal %o', async (payload) => {
		const { registerCardSocketListener } = await loadModule();
		registerCardSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;

		listener({ type: 'rerollRolling', ...payload });

		expect(await rollingOf('message-1')).toBeNull();
	});
});

describe('rejectCardRequest', () => {
	const rejection = {
		messageId: 'message-1',
		entryId: 'entry-1',
		userId: 'player-1',
		reasonKey: 'NIMBLE.chat.incomingReactions.poolSpendStale',
	};

	it('relays to the requesting client when the refusal happened elsewhere', async () => {
		const { rejectCardRequest } = await loadModule();
		setUser({ id: 'gm-user', isGM: true });

		rejectCardRequest(rejection);

		expect(globals().game.socket.emit).toHaveBeenCalledWith('system.nimble', {
			type: 'incomingAttackReactionRejected',
			...rejection,
		});
		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
	});

	it('shows a GM their own refusal without a socket round trip', async () => {
		const { rejectCardRequest } = await loadModule();
		setUser({ id: 'gm-user', isGM: true });

		rejectCardRequest({ ...rejection, userId: 'gm-user' });

		expect(globals().game.socket.emit).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
	});
});

describe('requestKeepChoice', () => {
	it('keeps the result directly for a GM', async () => {
		const { requestKeepChoice } = await loadModule();
		const message = createMessage([]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestKeepChoice({ messageId: 'message-1', choice: 'old' });

		expect(message.cardRerolls.resolveKeepChoice).toHaveBeenCalledWith('old', 'gm-user', false);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('asks the GM for a player, and the GM keeps only a known choice', async () => {
		const { requestKeepChoice, registerCardSocketListener } = await loadModule();
		setUser({ id: 'player-1', isGM: false });
		await requestKeepChoice({ messageId: 'message-1', choice: 'new' });
		const payload = globals().game.socket.emit?.mock.calls[0]?.[1];
		expect(payload).toEqual({
			type: 'rerollKeep',
			messageId: 'message-1',
			userId: 'player-1',
			choice: 'new',
		});

		const message = createMessage([]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });
		registerCardSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;
		listener(payload);
		listener({ ...payload, choice: 'both' });
		for (let i = 0; i < 4; i++) await Promise.resolve();

		expect(message.cardRerolls.resolveKeepChoice).toHaveBeenCalledTimes(1);
		expect(message.cardRerolls.resolveKeepChoice).toHaveBeenCalledWith('new', 'player-1', true);
	});
});

describe('requestResultRemoval', () => {
	it('removes the line directly for a GM', async () => {
		const { requestResultRemoval } = await loadModule();
		const message = createMessage([]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestResultRemoval({ messageId: 'message-1', lineId: 'line-1' });

		expect(message.cardRerolls.resolveResultRemoval).toHaveBeenCalledWith(
			'line-1',
			'gm-user',
			false,
		);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('asks the primary GM for a player, as a socket request', async () => {
		const { requestResultRemoval, registerCardSocketListener } = await loadModule();
		setUser({ id: 'player-1', isGM: false });
		await requestResultRemoval({ messageId: 'message-1', lineId: 'line-1' });
		const payload = globals().game.socket.emit?.mock.calls[0]?.[1];
		expect(payload).toEqual({
			type: 'resultRemoval',
			messageId: 'message-1',
			lineId: 'line-1',
			userId: 'player-1',
		});

		const message = createMessage([]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });
		registerCardSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;
		listener(payload);
		listener({ ...payload, lineId: undefined });
		for (let i = 0; i < 4; i++) await Promise.resolve();

		expect(message.cardRerolls.resolveResultRemoval).toHaveBeenCalledTimes(1);
		expect(message.cardRerolls.resolveResultRemoval).toHaveBeenCalledWith(
			'line-1',
			'player-1',
			true,
		);
	});
});

describe('requestDamageBack', () => {
	it('deals the damage directly for a GM', async () => {
		const { requestDamageBack } = await loadModule();
		const message = createMessage([]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestDamageBack({ messageId: 'message-1', recordId: 'record-1', action: 'double' });

		expect(message.cardDamageBack.resolve).toHaveBeenCalledWith(
			'record-1',
			'double',
			'gm-user',
			false,
		);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('asks the primary GM for a player, and the GM runs only a known action', async () => {
		const { requestDamageBack, registerCardSocketListener } = await loadModule();
		setUser({ id: 'player-1', isGM: false });
		await requestDamageBack({ messageId: 'message-1', recordId: 'record-1', action: 'deal' });
		const payload = globals().game.socket.emit?.mock.calls[0]?.[1];
		expect(payload).toEqual({
			type: 'damageBack',
			messageId: 'message-1',
			recordId: 'record-1',
			action: 'deal',
			userId: 'player-1',
		});

		const message = createMessage([]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });
		registerCardSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;
		listener(payload);
		listener({ ...payload, action: 'triple' });
		listener({ ...payload, recordId: '' });
		for (let i = 0; i < 4; i++) await Promise.resolve();

		expect(message.cardDamageBack.resolve).toHaveBeenCalledTimes(1);
		expect(message.cardDamageBack.resolve).toHaveBeenCalledWith(
			'record-1',
			'deal',
			'player-1',
			true,
		);
	});
});
