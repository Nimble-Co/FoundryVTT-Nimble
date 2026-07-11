import { describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantsCollectionFixture,
} from '../../tests/fixtures/combat.js';
import { createMockCombatant } from '../../tests/mocks/combat.js';
import { combatantActionMutationQueue } from './combatantActionMutationQueue.js';
import {
	canUserTakeCombatTurn,
	consumeCombatantAction,
	getCombatantMaxActions,
	registerCombatTurnSocketListener,
	requestAdvanceCombatTurn,
	requestSetActiveCombatTurn,
	requestSwapCombatTurn,
	resolveCombatantCurrentActionsAfterDelta,
} from './combatTurnActions.js';

describe('getCombatantMaxActions', () => {
	it('returns the base max for a non-dying combatant', () => {
		const combatant = createMockCombatant({ actionsMax: 3 });
		expect(getCombatantMaxActions(combatant)).toBe(3);
	});

	it('caps the max at 1 when the combatant is Dying', () => {
		const combatant = createMockCombatant({
			actionsMax: 3,
			actor: Object.assign(createCombatActorFixture({ type: 'character' }), {
				statuses: new Set(['dying']),
			}) as Actor.Implementation,
		});
		expect(getCombatantMaxActions(combatant)).toBe(1);
	});
});

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

describe('requestSwapCombatTurn', () => {
	it('swaps the active turn directly for a GM user', async () => {
		const swapTurnWithActiveCombatant = vi.fn().mockResolvedValue(true);
		const activeCombatant = createMockCombatant({
			id: 'combatant-active',
			type: 'character',
			combatId: 'combat-gm-swap',
		});
		const targetCombatant = createMockCombatant({
			id: 'combatant-target',
			type: 'character',
			combatId: 'combat-gm-swap',
		});
		const combat = {
			id: 'combat-gm-swap',
			started: true,
			combatant: activeCombatant,
			combatants: createCombatantsCollectionFixture([activeCombatant, targetCombatant]),
			swapTurnWithActiveCombatant,
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: { user: { id: string; isGM: boolean } };
			}
		).game.user = { id: 'gm-user', isGM: true };

		await expect(
			requestSwapCombatTurn({ combat, targetCombatantId: 'combatant-target' }),
		).resolves.toBe(true);
		expect(swapTurnWithActiveCombatant).toHaveBeenCalledWith('combatant-target');
	});

	it('refuses to swap when the target is already the active combatant', async () => {
		const swapTurnWithActiveCombatant = vi.fn().mockResolvedValue(true);
		const activeCombatant = createMockCombatant({
			id: 'combatant-active',
			type: 'character',
			combatId: 'combat-gm-swap-self',
		});
		const combat = {
			id: 'combat-gm-swap-self',
			started: true,
			combatant: activeCombatant,
			combatants: createCombatantsCollectionFixture([activeCombatant]),
			swapTurnWithActiveCombatant,
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: { user: { id: string; isGM: boolean } };
			}
		).game.user = { id: 'gm-user', isGM: true };

		await expect(
			requestSwapCombatTurn({ combat, targetCombatantId: 'combatant-active' }),
		).resolves.toBe(false);
		expect(swapTurnWithActiveCombatant).not.toHaveBeenCalled();
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

describe('canUserTakeCombatTurn', () => {
	function createCharacterCombatant(id: string, ownerId: string | null): Combatant.Implementation {
		const actor = {
			...createCombatActorFixture({
				id: `actor-${id}`,
				type: 'character',
				woundsValue: 0,
				woundsMax: 6,
			}),
			testUserPermission: vi.fn((user: { id?: string | null }) => user?.id === ownerId),
		} as unknown as Actor.Implementation;
		return createMockCombatant({ id, type: 'character', actor, combatId: 'combat-take-turn' });
	}

	function createMonsterCombatant(id: string): Combatant.Implementation {
		return createMockCombatant({
			id,
			type: 'npc',
			actor: createCombatActorFixture({ id: `actor-${id}`, hp: 20 }),
			combatId: 'combat-take-turn',
		});
	}

	function createCombat(
		activeCombatant: Combatant.Implementation | null,
		combatants: Combatant.Implementation[],
	): Combat {
		return {
			id: 'combat-take-turn',
			started: true,
			combatant: activeCombatant,
			combatants: createCombatantsCollectionFixture(combatants),
		} as unknown as Combat;
	}

	it('lets a GM hand the turn to any living combatant, including a monster', () => {
		const player = createCharacterCombatant('player-one', 'player-owner');
		const monster = createMonsterCombatant('monster-one');
		const combat = createCombat(player, [player, monster]);
		const gm = { id: 'gm-user', isGM: true } as User.Implementation;

		expect(canUserTakeCombatTurn(combat, monster, gm)).toBe(true);
	});

	it('lets an owner swap the turn to their character while a fellow player is active', () => {
		const activePlayer = createCharacterCombatant('player-one', 'other-owner');
		const ownedPlayer = createCharacterCombatant('player-two', 'player-owner');
		const combat = createCombat(activePlayer, [activePlayer, ownedPlayer]);
		const owner = { id: 'player-owner', isGM: false } as User.Implementation;

		expect(canUserTakeCombatTurn(combat, ownedPlayer, owner)).toBe(true);
	});

	it('forbids an owner from pulling the turn away from an active monster', () => {
		const activeMonster = createMonsterCombatant('monster-one');
		const ownedPlayer = createCharacterCombatant('player-two', 'player-owner');
		const combat = createCombat(activeMonster, [activeMonster, ownedPlayer]);
		const owner = { id: 'player-owner', isGM: false } as User.Implementation;

		expect(canUserTakeCombatTurn(combat, ownedPlayer, owner)).toBe(false);
	});

	it('forbids an owner from claiming the turn for a character they do not own', () => {
		const activePlayer = createCharacterCombatant('player-one', 'other-owner');
		const unownedPlayer = createCharacterCombatant('player-two', 'other-owner');
		const combat = createCombat(activePlayer, [activePlayer, unownedPlayer]);
		const owner = { id: 'player-owner', isGM: false } as User.Implementation;

		expect(canUserTakeCombatTurn(combat, unownedPlayer, owner)).toBe(false);
	});
});

describe('requestSetActiveCombatTurn', () => {
	it('applies the change directly for a GM user', async () => {
		const setActiveTurnToCombatant = vi.fn().mockResolvedValue(true);
		const target = createMockCombatant({ id: 'target', type: 'character', combatId: 'combat-set' });
		const active = createMockCombatant({ id: 'active', type: 'character', combatId: 'combat-set' });
		const combat = {
			id: 'combat-set',
			started: true,
			combatant: active,
			combatants: createCombatantsCollectionFixture([active, target]),
			setActiveTurnToCombatant,
		} as unknown as Combat;

		(globalThis as unknown as { game: { user: { id: string; isGM: boolean } } }).game.user = {
			id: 'gm-user',
			isGM: true,
		};

		await expect(requestSetActiveCombatTurn({ combat, targetCombatantId: 'target' })).resolves.toBe(
			true,
		);
		expect(setActiveTurnToCombatant).toHaveBeenCalledWith('target');
	});

	it('returns false without acting when the target is already active', async () => {
		const setActiveTurnToCombatant = vi.fn().mockResolvedValue(true);
		const active = createMockCombatant({ id: 'active', type: 'character', combatId: 'combat-set' });
		const combat = {
			id: 'combat-set',
			started: true,
			combatant: active,
			combatants: createCombatantsCollectionFixture([active]),
			setActiveTurnToCombatant,
		} as unknown as Combat;

		(globalThis as unknown as { game: { user: { id: string; isGM: boolean } } }).game.user = {
			id: 'gm-user',
			isGM: true,
		};

		await expect(requestSetActiveCombatTurn({ combat, targetCombatantId: 'active' })).resolves.toBe(
			false,
		);
		expect(setActiveTurnToCombatant).not.toHaveBeenCalled();
	});

	it('relays a socket request for an eligible owner swapping with a fellow player', async () => {
		const socketEmit = vi.fn();
		const activeActor = {
			...createCombatActorFixture({
				id: 'actor-active',
				type: 'character',
				woundsValue: 0,
				woundsMax: 6,
			}),
			testUserPermission: vi.fn(() => false),
		} as unknown as Actor.Implementation;
		const active = createMockCombatant({
			id: 'active',
			type: 'character',
			actor: activeActor,
			combatId: 'combat-set',
		});
		const targetActor = {
			...createCombatActorFixture({
				id: 'actor-target',
				type: 'character',
				woundsValue: 0,
				woundsMax: 6,
			}),
			testUserPermission: vi.fn((user: { id?: string | null }) => user?.id === 'player-owner'),
		} as unknown as Actor.Implementation;
		const target = createMockCombatant({
			id: 'target',
			type: 'character',
			actor: targetActor,
			combatId: 'combat-set',
		});
		const combat = {
			id: 'combat-set',
			started: true,
			combatant: active,
			combatants: createCombatantsCollectionFixture([active, target]),
		} as unknown as Combat;

		(
			globalThis as unknown as {
				game: {
					socket: { emit: ReturnType<typeof vi.fn> };
					user: { id: string; isGM: boolean };
					users: {
						activeGM: { id: string };
						contents: Array<{ id: string; isGM: boolean; active: boolean }>;
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
						contents: Array<{ id: string; isGM: boolean; active: boolean }>;
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
						contents: Array<{ id: string; isGM: boolean; active: boolean }>;
					};
				};
			}
		).game.users = {
			activeGM: { id: 'gm-user' },
			contents: [{ id: 'gm-user', isGM: true, active: true }],
		};

		await expect(requestSetActiveCombatTurn({ combat, targetCombatantId: 'target' })).resolves.toBe(
			true,
		);
		expect(socketEmit).toHaveBeenCalledWith('system.nimble', {
			type: 'setActiveCombatTurn',
			combatId: 'combat-set',
			userId: 'player-owner',
			targetCombatantId: 'target',
			expectedActiveCombatantId: 'active',
		});
	});
});
