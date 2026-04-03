import { describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantsCollectionFixture,
} from '../../tests/fixtures/combat.js';
import { createMockCombatant } from '../../tests/mocks/combat.js';
import { combatantActionMutationQueue } from './combatantActionMutationQueue.js';
import {
	consumeCombatantAction,
	registerCombatTurnSocketListener,
	requestAdvanceCombatTurn,
	resolveCombatantCurrentActionsAfterDelta,
} from './combatTurnActions.js';

describe('resolveCombatantCurrentActionsAfterDelta', () => {
	it('clamps increases at max actions', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 9,
				maxActions: 10,
				delta: 1,
			}),
		).toBe(10);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 10,
				maxActions: 10,
				delta: 1,
			}),
		).toBe(10);
	});

	it('allows GMs to overflow above max when explicitly enabled', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 3,
				maxActions: 3,
				delta: 2,
				allowOverflow: true,
			}),
		).toBe(5);
	});

	it('clamps decreases at zero actions', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 1,
				maxActions: 10,
				delta: -1,
			}),
		).toBe(0);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 0,
				maxActions: 10,
				delta: -1,
			}),
		).toBe(0);
	});

	it('normalizes invalid and float values before applying delta', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 3.8,
				maxActions: 7.2,
				delta: 1.9,
			}),
		).toBe(4);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: Number.NaN,
				maxActions: 5,
				delta: 1,
			}),
		).toBe(1);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 6,
				maxActions: 4,
				delta: -1,
			}),
		).toBe(3);
	});
});

describe('requestAdvanceCombatTurn', () => {
	it('advances the turn directly for a GM user', async () => {
		const nextTurn = vi.fn().mockResolvedValue(undefined);
		const combat = {
			id: 'combat-gm',
			combatant: createMockCombatant({ id: 'combatant-gm' }),
			nextTurn,
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: { user: { id: string; isGM: boolean } };
			}
		).game.user = { id: 'gm-user', isGM: true };

		await expect(requestAdvanceCombatTurn({ combat })).resolves.toBe(true);
		expect(nextTurn).toHaveBeenCalledTimes(1);
	});

	it('waits for queued combatant action mutations before advancing turn', async () => {
		const nextTurn = vi.fn().mockResolvedValue(undefined);
		const combat = {
			id: 'combat-gm-pending-actions',
			combatant: createMockCombatant({ id: 'combatant-gm-pending-actions' }),
			nextTurn,
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: { user: { id: string; isGM: boolean } };
			}
		).game.user = { id: 'gm-user', isGM: true };

		let releaseMutationBlocker: () => void = () => undefined;
		const mutationBlocker = new Promise<void>((resolve) => {
			releaseMutationBlocker = resolve;
		});
		const mutationPromise = combatantActionMutationQueue.queue({
			combat,
			combatantId: 'combatant-gm-pending-actions',
			mutation: async () => await mutationBlocker,
		});

		const advancePromise = requestAdvanceCombatTurn({ combat });
		await Promise.resolve();
		expect(nextTurn).not.toHaveBeenCalled();

		releaseMutationBlocker();
		await mutationPromise;
		await expect(advancePromise).resolves.toBe(true);
		expect(nextTurn).toHaveBeenCalledTimes(1);
	});

	it('emits a socket request for a non-GM owner', async () => {
		const socketEmit = vi.fn();
		const combatant = createMockCombatant({
			id: 'combatant-owner',
			actor: {
				...createCombatActorFixture({ id: 'actor-owner', isOwner: true }),
				isOwner: true,
			} as Actor.Implementation,
		});
		const combat = {
			id: 'combat-owner',
			combatant,
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: {
					socket: { emit: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
					};
				};
			}
		).game.socket = { emit: socketEmit };
		(
			globalThis as unknown as {
				game: {
					socket: { emit: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
					};
				};
			}
		).game.user = { id: 'player-owner', isGM: false };
		(
			globalThis as unknown as {
				game: {
					socket: { emit: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
					};
				};
			}
		).game.users = {
			activeGM: { id: 'gm-user' },
			contents: [{ id: 'gm-user', isGM: true, active: true }],
		};

		await expect(requestAdvanceCombatTurn({ combat })).resolves.toBe(true);
		expect(socketEmit).toHaveBeenCalledWith('system.nimble', {
			type: 'advanceCombatTurn',
			combatId: 'combat-owner',
			userId: 'player-owner',
			activeCombatantId: 'combatant-owner',
		});
	});
});

describe('registerCombatTurnSocketListener', () => {
	it('allows the active GM to advance turn requests from an owner', async () => {
		const socketOn = vi.fn();
		const nextTurn = vi.fn().mockResolvedValue(undefined);
		const actor = {
			...createCombatActorFixture({ id: 'actor-owner' }),
			testUserPermission: vi.fn((user: { id?: string | null }) => user.id === 'player-owner'),
		} as unknown as Actor.Implementation;
		const activeCombatant = createMockCombatant({
			id: 'combatant-owner',
			actor,
			combatId: 'combat-socket',
		});
		const combat = {
			id: 'combat-socket',
			started: true,
			combatant: activeCombatant,
			combatants: createCombatantsCollectionFixture([activeCombatant]),
			nextTurn,
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: {
					socket: { on: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
						get: (id: string) => User.Implementation | null;
					};
					combats: { get: (id: string) => Combat | null; contents: Combat[] };
				};
			}
		).game.socket = { on: socketOn };
		(
			globalThis as unknown as {
				game: {
					socket: { on: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
						get: (id: string) => User.Implementation | null;
					};
					combats: { get: (id: string) => Combat | null; contents: Combat[] };
				};
			}
		).game.user = { id: 'gm-user', isGM: true };
		(
			globalThis as unknown as {
				game: {
					socket: { on: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
						get: (id: string) => User.Implementation | null;
					};
					combats: { get: (id: string) => Combat | null; contents: Combat[] };
				};
			}
		).game.users = {
			activeGM: { id: 'gm-user' },
			contents: [
				{ id: 'gm-user', isGM: true, active: true },
				{ id: 'player-owner', isGM: false, active: true },
			],
			get: (id: string) =>
				id === 'player-owner'
					? ({ id: 'player-owner', isGM: false } as User.Implementation)
					: ({ id: 'gm-user', isGM: true } as User.Implementation),
		};
		(
			globalThis as unknown as {
				game: {
					socket: { on: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ active: boolean; id: string; isGM: boolean }>;
						get: (id: string) => User.Implementation | null;
					};
					combats: { get: (id: string) => Combat | null; contents: Combat[] };
				};
			}
		).game.combats = {
			get: (id: string) => (id === 'combat-socket' ? combat : null),
			contents: [combat],
		};

		registerCombatTurnSocketListener();
		const listener = socketOn.mock.calls[0]?.[1] as ((payload: unknown) => void) | undefined;
		expect(listener).toBeTypeOf('function');

		listener?.({
			type: 'advanceCombatTurn',
			combatId: 'combat-socket',
			userId: 'player-owner',
			activeCombatantId: 'combatant-owner',
		});

		await Promise.resolve();
		await Promise.resolve();

		expect(nextTurn).toHaveBeenCalledTimes(1);
	});
});

describe('consumeCombatantAction', () => {
	function createCombatWithCombatant(combatantId: string, actionsCurrent: number) {
		const combatant = createMockCombatant({
			id: combatantId,
			actionsCurrent,
			actionsMax: 3,
		});
		const combatants = createCombatantsCollectionFixture([combatant]);
		const updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		const combat = {
			id: 'combat-action',
			combatants,
			updateEmbeddedDocuments,
		} as unknown as Combat;
		return { combat, combatant, updateEmbeddedDocuments };
	}

	it('deducts 2 actions when actionCost is 2', async () => {
		const { combat, updateEmbeddedDocuments } = createCombatWithCombatant('c1', 3);

		const result = await consumeCombatantAction({
			combat,
			combatantId: 'c1',
			actionCost: 2,
		});

		expect(result).toBe(1);
		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'c1', 'system.actions.base.current': 1 },
		]);
	});

	it('defaults to 1 action when actionCost is undefined', async () => {
		const { combat, updateEmbeddedDocuments } = createCombatWithCombatant('c1', 3);

		const result = await consumeCombatantAction({
			combat,
			combatantId: 'c1',
		});

		expect(result).toBe(2);
		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'c1', 'system.actions.base.current': 2 },
		]);
	});

	it('normalizes actionCost of 0 to 1', async () => {
		const { combat, updateEmbeddedDocuments } = createCombatWithCombatant('c1', 3);

		const result = await consumeCombatantAction({
			combat,
			combatantId: 'c1',
			actionCost: 0,
		});

		expect(result).toBe(2);
		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'c1', 'system.actions.base.current': 2 },
		]);
	});

	it('normalizes negative actionCost to 1', async () => {
		const { combat, updateEmbeddedDocuments } = createCombatWithCombatant('c1', 3);

		const result = await consumeCombatantAction({
			combat,
			combatantId: 'c1',
			actionCost: -5,
		});

		expect(result).toBe(2);
		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'c1', 'system.actions.base.current': 2 },
		]);
	});
});
