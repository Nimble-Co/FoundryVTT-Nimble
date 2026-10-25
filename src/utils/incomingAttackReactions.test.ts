import { beforeEach, describe, expect, it, vi } from 'vitest';

type ReactionModule = typeof import('./incomingAttackReactions.js');

interface MockMessage {
	system: { incomingReactions: Array<{ id: string; kind: string }> };
	resolveRedirectReaction: ReturnType<typeof vi.fn>;
	resolveRerollReaction: ReturnType<typeof vi.fn>;
	resolveKeepChoice: ReturnType<typeof vi.fn>;
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
		resolveRerollReaction: vi.fn().mockResolvedValue(undefined),
		resolveKeepChoice: vi.fn().mockResolvedValue(undefined),
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

// The module keeps a "listener already registered" flag at module scope, so
// every test needs a fresh module instance to register its own socket spy.
async function loadModule(): Promise<ReactionModule> {
	vi.resetModules();
	return import('./incomingAttackReactions.js');
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

		expect(message.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'gm-user',
			false,
			false,
			null,
		);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('does nothing, and does not throw, for a legacy forceReroll entry', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(true);

		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
		expect(message.resolveRedirectReaction).not.toHaveBeenCalled();
	});

	it('routes a redirectToSelf entry to resolveRedirectReaction for a GM user', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'redirectToSelf' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' });

		expect(message.resolveRedirectReaction).toHaveBeenCalledWith('entry-1', 'gm-user', false);
		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

		expect(message.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'gm-user',
			false,
			true,
			null,
		);
	});

	it("sends a player's picked die to the GM", async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		setUser({ id: 'player-1', isGM: false });

		await requestIncomingAttackReaction({
			messageId: 'message-1',
			entryId: 'entry-1',
			die: { term: 0, result: 1 },
		});

		expect(globals().game.socket.emit).toHaveBeenCalledWith(
			'system.nimble',
			expect.objectContaining({ die: { term: 0, result: 1 } }),
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
		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

describe('registerIncomingReactionSocketListener', () => {
	async function registerAndGetListener(): Promise<(payload: unknown) => void> {
		const { registerIncomingReactionSocketListener } = await loadModule();
		registerIncomingReactionSocketListener();

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

		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

		expect(message.resolveRerollReaction).toHaveBeenCalledWith(
			'entry-1',
			'player-1',
			true,
			false,
			null,
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
			die,
		});

		listener(request({ term: 2, result: 0 }));
		listener(request({ term: -1, result: 0 }));
		listener(request({ term: '2', result: 0 }));
		await flushAsync();

		const dice = message.resolveRerollReaction.mock.calls.map((call) => call[4]);
		expect(dice).toEqual([{ term: 2, result: 0 }, null, null]);
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
		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
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

		expect(message.resolveRerollReaction).not.toHaveBeenCalled();
	});

	it('registers the socket listener only once per module instance', async () => {
		const { registerIncomingReactionSocketListener } = await loadModule();
		registerIncomingReactionSocketListener();
		registerIncomingReactionSocketListener();

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
		const { rollingRerollOf } = await import('./rerollRolling.svelte.js');
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
		const { registerIncomingReactionSocketListener } = await loadModule();
		registerIncomingReactionSocketListener();
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
		const { registerIncomingReactionSocketListener } = await loadModule();
		registerIncomingReactionSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;

		listener({ type: 'rerollRolling', ...payload });

		expect(await rollingOf('message-1')).toBeNull();
	});
});

describe('rejectIncomingAttackReaction', () => {
	const rejection = {
		messageId: 'message-1',
		entryId: 'entry-1',
		userId: 'player-1',
		reasonKey: 'NIMBLE.chat.incomingReactions.poolSpendStale',
	};

	it('relays to the requesting client when the refusal happened elsewhere', async () => {
		const { rejectIncomingAttackReaction } = await loadModule();
		setUser({ id: 'gm-user', isGM: true });

		rejectIncomingAttackReaction(rejection);

		expect(globals().game.socket.emit).toHaveBeenCalledWith('system.nimble', {
			type: 'incomingAttackReactionRejected',
			...rejection,
		});
		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
	});

	it('shows a GM their own refusal without a socket round trip', async () => {
		const { rejectIncomingAttackReaction } = await loadModule();
		setUser({ id: 'gm-user', isGM: true });

		rejectIncomingAttackReaction({ ...rejection, userId: 'gm-user' });

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

		expect(message.resolveKeepChoice).toHaveBeenCalledWith('old', 'gm-user', false);
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('asks the GM for a player, and the GM keeps only a known choice', async () => {
		const { requestKeepChoice, registerIncomingReactionSocketListener } = await loadModule();
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
		registerIncomingReactionSocketListener();
		const listener = globals().game.socket.on?.mock.calls[0]?.[1] as (payload: unknown) => void;
		listener(payload);
		listener({ ...payload, choice: 'both' });
		for (let i = 0; i < 4; i++) await Promise.resolve();

		expect(message.resolveKeepChoice).toHaveBeenCalledTimes(1);
		expect(message.resolveKeepChoice).toHaveBeenCalledWith('new', 'player-1', true);
	});
});
