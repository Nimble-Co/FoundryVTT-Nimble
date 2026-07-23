import { beforeEach, describe, expect, it, vi } from 'vitest';

type ReactionModule = typeof import('./incomingAttackReactions.js');

interface MockMessage {
	system: { incomingReactions: Array<{ id: string; kind: string }> };
	resolveForceRerollReaction: ReturnType<typeof vi.fn>;
	resolveRedirectReaction: ReturnType<typeof vi.fn>;
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
};

function globals(): TestGlobals {
	return globalThis as unknown as TestGlobals;
}

function createMessage(entries: Array<{ id: string; kind: string }>): MockMessage {
	return {
		system: { incomingReactions: entries },
		resolveForceRerollReaction: vi.fn().mockResolvedValue(undefined),
		resolveRedirectReaction: vi.fn().mockResolvedValue(undefined),
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
});

describe('requestIncomingAttackReaction', () => {
	it('executes the reaction directly for a GM user without emitting a socket request', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await expect(
			requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' }),
		).resolves.toBe(true);

		expect(message.resolveForceRerollReaction).toHaveBeenCalledWith('entry-1', 'gm-user');
		expect(globals().game.socket.emit).not.toHaveBeenCalled();
	});

	it('routes a redirectToSelf entry to resolveRedirectReaction for a GM user', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'redirectToSelf' }]);
		setMessages({ 'message-1': message });
		setUser({ id: 'gm-user', isGM: true });

		await requestIncomingAttackReaction({ messageId: 'message-1', entryId: 'entry-1' });

		expect(message.resolveRedirectReaction).toHaveBeenCalledWith('entry-1', 'gm-user');
		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
	});

	it('emits a socket request with the expected payload for a non-GM user', async () => {
		const { requestIncomingAttackReaction } = await loadModule();
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
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
		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
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

	it('lets the primary active GM execute a forceReroll request', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.resolveForceRerollReaction).toHaveBeenCalledWith('entry-1', 'player-1');
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

		expect(message.resolveRedirectReaction).toHaveBeenCalledWith('entry-1', 'player-1');
		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
	});

	it('ignores requests of a different type', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'advanceCombatTurn',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
		expect(message.resolveRedirectReaction).not.toHaveBeenCalled();
	});

	it('ignores requests on non-GM clients', async () => {
		setUser({ id: 'player-2', isGM: false });
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
	});

	it('only executes on the primary active GM client', async () => {
		setUser({ id: 'secondary-gm', isGM: true });
		setActiveGm('gm-user');
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({
			type: 'incomingAttackReaction',
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
		});
		await flushAsync();

		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
	});

	it('ignores malformed payloads missing required fields', async () => {
		setUser({ id: 'gm-user', isGM: true });
		const message = createMessage([{ id: 'entry-1', kind: 'forceReroll' }]);
		setMessages({ 'message-1': message });
		const listener = await registerAndGetListener();

		listener({ type: 'incomingAttackReaction', messageId: 'message-1' });
		listener(null);
		listener('not-an-object');
		await flushAsync();

		expect(message.resolveForceRerollReaction).not.toHaveBeenCalled();
	});

	it('registers the socket listener only once per module instance', async () => {
		const { registerIncomingReactionSocketListener } = await loadModule();
		registerIncomingReactionSocketListener();
		registerIncomingReactionSocketListener();

		expect(globals().game.socket.on).toHaveBeenCalledTimes(1);
	});
});
