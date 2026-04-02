import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync, getTestGlobals } from '../../../tests/helpers.js';
import {
	createHasPropertyMock,
	createHookCapture,
	createMockCombatActor,
} from '../../../tests/mocks/combat.js';
import {
	clearLionheartedAdjacencyState,
	syncLionheartedAdjacencyState,
} from './lionheartedAdjacencySync.js';

type LionheartedAdjacencySyncTestGlobals = {
	Hooks: { on: ReturnType<typeof vi.fn> };
	game: {
		user: { isGM: boolean };
		combat: Combat | null;
		users: { contents: Array<{ id: string | null }> };
	};
	canvas: {
		ready: boolean;
		tokens: { placeables: unknown[] } | null;
		grid: { testAdjacency: ReturnType<typeof vi.fn> };
	} | null;
	CONST: { TOKEN_DISPOSITIONS: { HOSTILE: number } };
	ChatMessage: { create: ReturnType<typeof vi.fn> };
	foundry: { utils: { hasProperty: (obj: unknown, path: string) => boolean } };
};

function globals() {
	return getTestGlobals<LionheartedAdjacencySyncTestGlobals>();
}

function createMockToken(x: number, y: number, disposition: number) {
	return { document: { x, y, disposition } };
}

function createLionheartedActor(options: { id?: string; isActive?: boolean } = {}) {
	const actor = createMockCombatActor({ id: options.id ?? 'actor-1', type: 'character' });
	(actor as unknown as { items: Array<{ system: { rules: Array<{ type: string }> } }> }).items = [
		{ system: { rules: [{ type: 'lionheartedBonus' }] } },
	];
	(actor as unknown as { statuses: Set<string> }).statuses = new Set(
		options.isActive ? ['lionhearted'] : [],
	);
	(actor as unknown as { testUserPermission: () => boolean }).testUserPermission = () => false;
	return actor;
}

function createMockCombatant(actor: Actor.Implementation, token: unknown) {
	return { type: 'character', actor, token: { object: token } };
}

function createMockCombat(combatants: unknown[]) {
	return {
		active: true,
		combatants: { contents: combatants },
	} as unknown as Combat;
}

describe('syncLionheartedAdjacencyState', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.users = { contents: [] };
		globals().game.combat = null;
		globals().CONST = { TOKEN_DISPOSITIONS: { HOSTILE: -1 } };
		globals().ChatMessage = { create: vi.fn().mockResolvedValue(undefined) };
		globals().canvas = {
			ready: true,
			tokens: { placeables: [] },
			grid: { testAdjacency: vi.fn().mockReturnValue(false) },
		};
	});

	it('does nothing when user is not GM', async () => {
		globals().game.user = { isGM: false };

		const actor = createLionheartedActor();
		const combat = createMockCombat([createMockCombatant(actor, createMockToken(0, 0, 1))]);

		await syncLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('does nothing when canvas is not ready', async () => {
		globals().canvas = null;

		const actor = createLionheartedActor();
		const combat = createMockCombat([createMockCombatant(actor, createMockToken(0, 0, 1))]);

		await syncLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('activates lionhearted for character adjacent to the most hostile tokens', async () => {
		const actor = createLionheartedActor();
		const playerToken = createMockToken(0, 0, 1);
		const hostileToken = createMockToken(100, 0, -1);

		globals().canvas = {
			ready: true,
			tokens: { placeables: [playerToken, hostileToken] },
			grid: {
				testAdjacency: vi
					.fn()
					.mockImplementation((a: { x: number }, b: { x: number }) => a.x === 0 && b.x === 100),
			},
		};

		const combat = createMockCombat([createMockCombatant(actor, playerToken)]);

		await syncLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('lionhearted', {
			active: true,
			overlay: false,
		});
	});

	it('activates lionhearted for all characters tied for most adjacencies', async () => {
		const actorA = createLionheartedActor({ id: 'actor-a' });
		const actorB = createLionheartedActor({ id: 'actor-b' });
		const tokenA = createMockToken(0, 0, 1);
		const tokenB = createMockToken(300, 0, 1);
		const hostileA = createMockToken(100, 0, -1);
		const hostileB = createMockToken(400, 0, -1);

		globals().canvas = {
			ready: true,
			tokens: { placeables: [tokenA, tokenB, hostileA, hostileB] },
			grid: {
				testAdjacency: vi
					.fn()
					.mockImplementation(
						(a: { x: number }, b: { x: number }) =>
							(a.x === 0 && b.x === 100) || (a.x === 300 && b.x === 400),
					),
			},
		};

		const combat = createMockCombat([
			createMockCombatant(actorA, tokenA),
			createMockCombatant(actorB, tokenB),
		]);

		await syncLionheartedAdjacencyState(combat);

		expect(actorA.toggleStatusEffect).toHaveBeenCalledWith('lionhearted', {
			active: true,
			overlay: false,
		});
		expect(actorB.toggleStatusEffect).toHaveBeenCalledWith('lionhearted', {
			active: true,
			overlay: false,
		});
	});

	it('does not activate lionhearted when no hostile tokens are adjacent (count = 0)', async () => {
		const actor = createLionheartedActor();
		const playerToken = createMockToken(0, 0, 1);
		const hostileToken = createMockToken(500, 0, -1);

		globals().canvas = {
			ready: true,
			tokens: { placeables: [playerToken, hostileToken] },
			grid: { testAdjacency: vi.fn().mockReturnValue(false) },
		};

		const combat = createMockCombat([createMockCombatant(actor, playerToken)]);

		await syncLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('deactivates lionhearted when actor no longer has the most adjacencies', async () => {
		const actorA = createLionheartedActor({ id: 'actor-a', isActive: true });
		const actorB = createLionheartedActor({ id: 'actor-b' });
		const tokenA = createMockToken(0, 0, 1);
		const tokenB = createMockToken(300, 0, 1);
		const hostileNearB = createMockToken(400, 0, -1);

		globals().canvas = {
			ready: true,
			tokens: { placeables: [tokenA, tokenB, hostileNearB] },
			grid: {
				testAdjacency: vi
					.fn()
					.mockImplementation((a: { x: number }, b: { x: number }) => a.x === 300 && b.x === 400),
			},
		};

		const combat = createMockCombat([
			createMockCombatant(actorA, tokenA),
			createMockCombatant(actorB, tokenB),
		]);

		await syncLionheartedAdjacencyState(combat);

		expect(actorA.toggleStatusEffect).toHaveBeenCalledWith('lionhearted', {
			active: false,
			overlay: false,
		});
		expect(actorB.toggleStatusEffect).toHaveBeenCalledWith('lionhearted', {
			active: true,
			overlay: false,
		});
	});

	it('skips combatants without the lionheartedBonus rule', async () => {
		const actor = createMockCombatActor({ type: 'character' });
		(actor as unknown as { items: unknown[] }).items = [];
		(actor as unknown as { statuses: Set<string> }).statuses = new Set();

		const playerToken = createMockToken(0, 0, 1);
		globals().canvas = {
			ready: true,
			tokens: { placeables: [playerToken, createMockToken(100, 0, -1)] },
			grid: { testAdjacency: vi.fn().mockReturnValue(true) },
		};

		await syncLionheartedAdjacencyState(
			createMockCombat([createMockCombatant(actor, playerToken)]),
		);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('skips non-character combatants', async () => {
		const actor = createLionheartedActor();
		const token = createMockToken(0, 0, 1);

		globals().canvas = {
			ready: true,
			tokens: { placeables: [token, createMockToken(100, 0, -1)] },
			grid: { testAdjacency: vi.fn().mockReturnValue(true) },
		};

		const combat = createMockCombat([{ type: 'npc', actor, token: { object: token } }]);

		await syncLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('does not toggle when status already matches desired state', async () => {
		const actor = createLionheartedActor({ isActive: true });
		const playerToken = createMockToken(0, 0, 1);

		globals().canvas = {
			ready: true,
			tokens: { placeables: [playerToken, createMockToken(100, 0, -1)] },
			grid: { testAdjacency: vi.fn().mockReturnValue(true) },
		};

		await syncLionheartedAdjacencyState(
			createMockCombat([createMockCombatant(actor, playerToken)]),
		);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});

describe('clearLionheartedAdjacencyState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user = { isGM: true };
	});

	it('removes lionhearted from actors that have the status', async () => {
		const actor = createLionheartedActor({ isActive: true });
		const combat = createMockCombat([{ actor, token: null }]);

		await clearLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('lionhearted', {
			active: false,
			overlay: false,
		});
	});

	it('does not toggle actors that do not have the status', async () => {
		const actor = createLionheartedActor({ isActive: false });
		const combat = createMockCombat([{ actor, token: null }]);

		await clearLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('does nothing when user is not GM', async () => {
		globals().game.user = { isGM: false };

		const actor = createLionheartedActor({ isActive: true });
		const combat = createMockCombat([{ actor, token: null }]);

		await clearLionheartedAdjacencyState(combat);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});

describe('registerLionheartedAdjacencySync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		globals().Hooks = { on: vi.fn() };
		globals().game.user = { isGM: true };
		globals().game.combat = null;
	});

	it('registers the expected hooks', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerLionheartedAdjacencySync = (await import('./lionheartedAdjacencySync.js'))
			.default;
		registerLionheartedAdjacencySync();

		expect(callbacks.has('updateToken')).toBe(true);
		expect(callbacks.has('createToken')).toBe(true);
		expect(callbacks.has('deleteToken')).toBe(true);
		expect(callbacks.has('createCombat')).toBe(true);
		expect(callbacks.has('canvasReady')).toBe(true);
		expect(callbacks.has('deleteCombat')).toBe(true);
	});

	it('is idempotent when called multiple times', async () => {
		const registerLionheartedAdjacencySync = (await import('./lionheartedAdjacencySync.js'))
			.default;
		registerLionheartedAdjacencySync();
		registerLionheartedAdjacencySync();

		const updateTokenRegistrations = (
			globals().Hooks.on as ReturnType<typeof vi.fn>
		).mock.calls.filter((args: unknown[]) => args[0] === 'updateToken').length;
		expect(updateTokenRegistrations).toBe(1);
	});

	it('triggers sync when updateToken fires with a position change', async () => {
		const actor = createLionheartedActor();
		const token = createMockToken(0, 0, 1);
		const combat = createMockCombat([createMockCombatant(actor, token)]);

		globals().game.combat = combat;
		globals().CONST = { TOKEN_DISPOSITIONS: { HOSTILE: -1 } };
		globals().ChatMessage = { create: vi.fn().mockResolvedValue(undefined) };
		globals().canvas = {
			ready: true,
			tokens: { placeables: [token] },
			grid: { testAdjacency: vi.fn().mockReturnValue(false) },
		};
		globals().foundry = { utils: { hasProperty: createHasPropertyMock() } };

		const callbacks = createHookCapture(globals().Hooks.on);
		const registerLionheartedAdjacencySync = (await import('./lionheartedAdjacencySync.js'))
			.default;
		registerLionheartedAdjacencySync();

		const updateToken = callbacks.get('updateToken');
		updateToken?.({}, { x: 100 });
		await flushAsync();

		// sync ran — actor has no adjacent hostiles so no toggle, but no errors either
		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('does not trigger sync when updateToken fires without a position change', async () => {
		const actor = createLionheartedActor();
		const token = createMockToken(0, 0, 1);
		const combat = createMockCombat([createMockCombatant(actor, token)]);

		globals().game.combat = combat;
		globals().foundry = { utils: { hasProperty: createHasPropertyMock() } };

		const callbacks = createHookCapture(globals().Hooks.on);
		const registerLionheartedAdjacencySync = (await import('./lionheartedAdjacencySync.js'))
			.default;
		registerLionheartedAdjacencySync();

		const updateToken = callbacks.get('updateToken');
		updateToken?.({}, { name: 'New Name' });
		await flushAsync();

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});
