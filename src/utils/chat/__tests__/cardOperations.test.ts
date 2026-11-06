import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

type CardOperationsModule = typeof import('../cardOperations.js');
type TestPayload = { target: string };
type Run = (
	payload: TestPayload,
	requester: { userId: string; viaSocket: boolean },
) => Promise<unknown>;
type Listener = (payload: unknown) => void;
type TestUser = { id: string; isGM: boolean };

type TestGlobals = {
	game: {
		user: TestUser | null;
		users: {
			activeGM: { id: string } | null;
			contents: Array<{ id: string; isGM: boolean; active: boolean }>;
			get: (id: string) => TestUser | undefined;
		};
		socket: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> } | undefined;
	};
	ui: { notifications: { warn: ReturnType<typeof vi.fn> } };
	Hooks: { callAll: ReturnType<typeof vi.fn> };
};

const CHANNEL = 'system.nimble';
const NO_GM_KEY = 'NIMBLE.test.noGm';
const REJECTED_HOOK = 'nimble.incomingReactionRejected';

function globals(): TestGlobals {
	return globalThis as unknown as TestGlobals;
}

function setUsers(current: TestUser | null, activeGmId: string | null, known: TestUser[] = []) {
	const everyone = [...known, ...(current ? [current] : [])];
	globals().game.user = current;
	globals().game.users = {
		activeGM: activeGmId ? { id: activeGmId } : null,
		contents: activeGmId ? [{ id: activeGmId, isGM: true, active: true }] : [],
		get: (id) => everyone.find((user) => user.id === id),
	};
}

const GM: TestUser = { id: 'gm-user', isGM: true };
const SECOND_GM: TestUser = { id: 'second-gm', isGM: true };
const PLAYER: TestUser = { id: 'player-1', isGM: false };

// The listener flag and the operations map live at module scope, so each test
// takes a fresh module.
async function loadModule(): Promise<CardOperationsModule> {
	vi.resetModules();
	return import('../cardOperations.js');
}

function defineTestOperation(
	module: CardOperationsModule,
	options: { run?: Mock<Run>; noGmKey?: string } = {},
) {
	const run = options.run ?? vi.fn<Run>().mockResolvedValue(undefined);
	const parse = vi.fn((raw: Record<string, unknown>): TestPayload | null =>
		typeof raw.target === 'string' ? { target: raw.target } : null,
	);
	const request = module.defineCardOperation<TestPayload>({
		type: 'testOperation',
		parse,
		run,
		...(options.noGmKey ? { noGmKey: options.noGmKey } : {}),
	});
	return { request, run, parse };
}

function listenerOf(module: CardOperationsModule): Listener {
	module.registerCardSocketListener();
	return globals().game.socket?.on.mock.calls[0]?.[1] as Listener;
}

async function flushAsync(): Promise<void> {
	for (let i = 0; i < 4; i++) await Promise.resolve();
}

beforeEach(() => {
	vi.clearAllMocks();
	setUsers(PLAYER, GM.id, [GM]);
	globals().game.socket = { on: vi.fn(), emit: vi.fn() };
	globals().ui = { notifications: { warn: vi.fn() } };
	globals().Hooks = { callAll: vi.fn() };
});

afterEach(() => vi.unstubAllGlobals());

describe('a card operation request', () => {
	it('runs at once for a GM, not via the socket', async () => {
		setUsers(GM, GM.id);
		const { request, run } = defineTestOperation(await loadModule());

		await expect(request({ target: 'a' })).resolves.toBe(true);

		expect(run).toHaveBeenCalledWith({ target: 'a' }, { userId: 'gm-user', viaSocket: false });
		expect(globals().game.socket?.emit).not.toHaveBeenCalled();
	});

	it('resolves false for a GM when the run resolves false', async () => {
		setUsers(GM, GM.id);
		const run = vi.fn<Run>().mockResolvedValue(false);
		const { request } = defineTestOperation(await loadModule(), { run });

		await expect(request({ target: 'a' })).resolves.toBe(false);
	});

	it('sends a player request to the GM with its type and user', async () => {
		const { request, run } = defineTestOperation(await loadModule());

		await expect(request({ target: 'a' })).resolves.toBe(true);

		expect(globals().game.socket?.emit).toHaveBeenCalledWith(CHANNEL, {
			target: 'a',
			type: 'testOperation',
			userId: 'player-1',
		});
		expect(run).not.toHaveBeenCalled();
	});

	it('resolves false and warns when no GM is connected and noGmKey is set', async () => {
		setUsers(PLAYER, null);
		const { request } = defineTestOperation(await loadModule(), { noGmKey: NO_GM_KEY });

		await expect(request({ target: 'a' })).resolves.toBe(false);

		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
		expect(globals().game.socket?.emit).not.toHaveBeenCalled();
	});

	it('resolves false without a warning when no GM is connected and noGmKey is not set', async () => {
		setUsers(PLAYER, null);
		const { request } = defineTestOperation(await loadModule());

		await expect(request({ target: 'a' })).resolves.toBe(false);

		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
	});

	it('resolves false and warns when there is no socket', async () => {
		globals().game.socket = undefined;
		const { request } = defineTestOperation(await loadModule(), { noGmKey: NO_GM_KEY });

		await expect(request({ target: 'a' })).resolves.toBe(false);

		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
	});

	it('resolves false when there is no logged-in user', async () => {
		setUsers(null, GM.id);
		const { request, run } = defineTestOperation(await loadModule());

		await expect(request({ target: 'a' })).resolves.toBe(false);

		expect(run).not.toHaveBeenCalled();
	});
});

describe('the card socket listener', () => {
	const PLAYER_REQUEST = { type: 'testOperation', target: 'a', userId: 'player-1' };

	it('listens on the system channel once', async () => {
		const module = await loadModule();

		module.registerCardSocketListener();
		module.registerCardSocketListener();

		expect(globals().game.socket?.on).toHaveBeenCalledTimes(1);
		expect(globals().game.socket?.on).toHaveBeenCalledWith(CHANNEL, expect.any(Function));
	});

	it('runs a relayed operation on the primary GM, via the socket', async () => {
		setUsers(GM, GM.id);
		const module = await loadModule();
		const { run } = defineTestOperation(module);

		listenerOf(module)(PLAYER_REQUEST);
		await flushAsync();

		expect(run).toHaveBeenCalledWith({ target: 'a' }, { userId: 'player-1', viaSocket: true });
	});

	it('does not run on a GM that is not the primary GM', async () => {
		setUsers(SECOND_GM, GM.id, [GM]);
		const module = await loadModule();
		const { run } = defineTestOperation(module);

		listenerOf(module)(PLAYER_REQUEST);
		await flushAsync();

		expect(run).not.toHaveBeenCalled();
	});

	it('does not run on a player client', async () => {
		const module = await loadModule();
		const { run } = defineTestOperation(module);

		listenerOf(module)(PLAYER_REQUEST);
		await flushAsync();

		expect(run).not.toHaveBeenCalled();
	});

	it.each([undefined, '', 7])('skips a request whose userId is %o', async (userId) => {
		setUsers(GM, GM.id);
		const module = await loadModule();
		const { run, parse } = defineTestOperation(module);

		listenerOf(module)({ ...PLAYER_REQUEST, userId });
		await flushAsync();

		expect(parse).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});

	it('skips a request that parse returns null for', async () => {
		setUsers(GM, GM.id);
		const module = await loadModule();
		const { run, parse } = defineTestOperation(module);

		listenerOf(module)({ ...PLAYER_REQUEST, target: 3 });
		await flushAsync();

		expect(parse).toHaveBeenCalledTimes(1);
		expect(run).not.toHaveBeenCalled();
	});

	it('ignores a payload that is not an object', async () => {
		setUsers(GM, GM.id);
		const module = await loadModule();
		const { run } = defineTestOperation(module);
		const listener = listenerOf(module);

		expect(() => {
			listener(null);
			listener('testOperation');
		}).not.toThrow();
		await flushAsync();

		expect(run).not.toHaveBeenCalled();
	});

	it('gives a notice to its handler on any client', async () => {
		const module = await loadModule();
		const handle = vi.fn();
		module.onCardNotice('testNotice', handle);

		listenerOf(module)({ type: 'testNotice', value: 1 });

		expect(handle).toHaveBeenCalledWith({ type: 'testNotice', value: 1 });
	});

	it('sends a notice to every other client', async () => {
		const module = await loadModule();

		module.sendCardNotice('testNotice', { value: 1 });

		expect(globals().game.socket?.emit).toHaveBeenCalledWith(CHANNEL, {
			value: 1,
			type: 'testNotice',
		});
	});
});

describe('rejectCardRequest', () => {
	const rejection = {
		messageId: 'message-1',
		entryId: 'entry-1',
		userId: 'player-1',
		reasonKey: 'NIMBLE.test.refused',
	};

	it('shows the refusal here when this client asked', async () => {
		setUsers(GM, GM.id);
		const module = await loadModule();

		module.rejectCardRequest({ ...rejection, userId: 'gm-user' });

		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
		expect(globals().Hooks.callAll).toHaveBeenCalledWith(REJECTED_HOOK, {
			...rejection,
			userId: 'gm-user',
		});
		expect(globals().game.socket?.emit).not.toHaveBeenCalled();
	});

	it('sends the refusal to the client that asked', async () => {
		setUsers(GM, GM.id);
		const module = await loadModule();

		module.rejectCardRequest(rejection);

		expect(globals().game.socket?.emit).toHaveBeenCalledWith(CHANNEL, {
			...rejection,
			type: 'incomingAttackReactionRejected',
		});
		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
	});
});

describe('the rejected notice', () => {
	const notice = {
		type: 'incomingAttackReactionRejected',
		messageId: 'message-1',
		entryId: 'entry-1',
		userId: 'player-1',
		reasonKey: 'NIMBLE.test.refused',
	};

	it('is delivered on the client of the user who asked', async () => {
		const module = await loadModule();

		listenerOf(module)(notice);

		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
		expect(globals().Hooks.callAll).toHaveBeenCalledWith(REJECTED_HOOK, {
			messageId: 'message-1',
			entryId: 'entry-1',
			userId: 'player-1',
			reasonKey: 'NIMBLE.test.refused',
		});
	});

	it('is delivered without an entryId when the refusal has none', async () => {
		const module = await loadModule();
		const { entryId: _entryId, ...withoutEntry } = notice;

		listenerOf(module)(withoutEntry);

		expect(globals().ui.notifications.warn).toHaveBeenCalledTimes(1);
		expect(globals().Hooks.callAll).toHaveBeenCalledWith(REJECTED_HOOK, {
			messageId: 'message-1',
			userId: 'player-1',
			reasonKey: 'NIMBLE.test.refused',
		});
	});

	it('is not delivered on the client of a different user', async () => {
		setUsers({ id: 'player-2', isGM: false }, GM.id);
		const module = await loadModule();

		listenerOf(module)(notice);

		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
		expect(globals().Hooks.callAll).not.toHaveBeenCalled();
	});

	it('is not delivered without a reason', async () => {
		const module = await loadModule();

		listenerOf(module)({ ...notice, reasonKey: '' });

		expect(globals().ui.notifications.warn).not.toHaveBeenCalled();
	});
});

describe('mayActFor', () => {
	function actorOwnedBy(ownerId: string) {
		return {
			testUserPermission: vi.fn(
				(user: TestUser, level: number) =>
					user.id === ownerId && level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			),
		};
	}

	it('lets a GM act on their own client', async () => {
		setUsers(GM, GM.id);
		const { mayActFor } = await loadModule();

		expect(mayActFor(null, { userId: 'gm-user', viaSocket: false })).toBe(true);
	});

	it('refuses a GM identity that comes over the socket', async () => {
		setUsers(GM, GM.id);
		const { mayActFor } = await loadModule();

		expect(mayActFor(actorOwnedBy('gm-user'), { userId: 'gm-user', viaSocket: true })).toBe(false);
	});

	it('lets a player act for an actor they own', async () => {
		setUsers(GM, GM.id, [PLAYER]);
		const { mayActFor } = await loadModule();

		expect(mayActFor(actorOwnedBy('player-1'), { userId: 'player-1', viaSocket: true })).toBe(true);
	});

	it('refuses a player for an actor they do not own', async () => {
		setUsers(GM, GM.id, [PLAYER]);
		const { mayActFor } = await loadModule();

		expect(mayActFor(actorOwnedBy('player-2'), { userId: 'player-1', viaSocket: true })).toBe(
			false,
		);
	});

	it('finds an actor given by uuid', async () => {
		setUsers(GM, GM.id, [PLAYER]);
		const actor = actorOwnedBy('player-1');
		const fromUuidSync = vi.fn(() => actor);
		vi.stubGlobal('fromUuidSync', fromUuidSync);
		const { mayActFor } = await loadModule();

		expect(mayActFor('Actor.abc', { userId: 'player-1', viaSocket: true })).toBe(true);
		expect(fromUuidSync).toHaveBeenCalledWith('Actor.abc');
	});

	it('refuses a user it does not know', async () => {
		setUsers(GM, GM.id);
		const { mayActFor } = await loadModule();

		expect(mayActFor(actorOwnedBy('ghost'), { userId: 'ghost', viaSocket: true })).toBe(false);
	});
});
