import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isMovementTrackingEnabledMock } = vi.hoisted(() => ({
	isMovementTrackingEnabledMock: vi.fn(() => true),
}));

vi.mock('../settings/automationSettings.js', () => ({
	isMovementTrackingAutomationEnabled: isMovementTrackingEnabledMock,
}));

type HookCallback = (...args: unknown[]) => unknown;

interface ActorStub {
	reset: ReturnType<typeof vi.fn>;
	render: ReturnType<typeof vi.fn>;
}

function captureHooks(): Map<string, HookCallback> {
	const hooks = new Map<string, HookCallback>();
	(globalThis as unknown as { Hooks: { on: ReturnType<typeof vi.fn> } }).Hooks = {
		on: vi.fn((event: string, callback: HookCallback) => {
			hooks.set(event, callback);
			return 1;
		}),
	};
	return hooks;
}

function createActor(): ActorStub {
	return { reset: vi.fn(), render: vi.fn() };
}

function createCombat(started: boolean, actors: Array<ActorStub | null>, previousRound = 0) {
	return {
		started,
		previous: { round: previousRound },
		combatants: actors.map((actor) => ({ actor })),
	};
}

function expectRefreshed(actor: ActorStub, times = 1): void {
	expect(actor.reset).toHaveBeenCalledTimes(times);
	expect(actor.render).toHaveBeenCalledTimes(times);
	expect(actor.render).toHaveBeenCalledWith(false);
}

function expectNotRefreshed(actor: ActorStub): void {
	expect(actor.reset).not.toHaveBeenCalled();
	expect(actor.render).not.toHaveBeenCalled();
}

async function register(): Promise<Map<string, HookCallback>> {
	const hooks = captureHooks();
	const { default: registerMovementHistoryRefresh } = await import('./movementHistoryRefresh.js');
	registerMovementHistoryRefresh();
	return hooks;
}

describe('registerMovementHistoryRefresh', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		isMovementTrackingEnabledMock.mockReturnValue(true);
	});

	it('re-prepares the token actor when Foundry records its movement history', async () => {
		const hooks = await register();
		const actor = createActor();

		hooks.get('recordToken')?.({ actor });

		expectRefreshed(actor);
	});

	it('re-prepares each combatant actor once when the combat starts', async () => {
		const hooks = await register();
		const shared = createActor();
		const other = createActor();
		const combat = createCombat(true, [shared, shared, other, null], 0);

		hooks.get('updateCombat')?.(combat, { round: 1, turn: 0 });

		expectRefreshed(shared);
		expectRefreshed(other);
	});

	it('re-prepares the combatant actors when a combat goes back to round 0', async () => {
		const hooks = await register();
		const actor = createActor();

		hooks.get('updateCombat')?.(createCombat(false, [actor], 1), { round: 0 });

		expectRefreshed(actor);
	});

	it('does nothing when the round of a started combat changes', async () => {
		const hooks = await register();
		const actor = createActor();

		hooks.get('updateCombat')?.(createCombat(true, [actor], 1), { round: 2, turn: 0 });
		hooks.get('updateCombat')?.(createCombat(true, [actor], 3), { round: 2, turn: 4 });

		expectNotRefreshed(actor);
	});

	it('does nothing when a combat update does not change the round', async () => {
		const hooks = await register();
		const actor = createActor();

		hooks.get('updateCombat')?.(createCombat(true, [actor]), { turn: 2 });

		expectNotRefreshed(actor);
	});

	it('re-prepares the combatant actors when a started combat is created or deleted', async () => {
		const hooks = await register();
		const actor = createActor();
		const combat = createCombat(true, [actor]);

		hooks.get('createCombat')?.(combat);
		hooks.get('deleteCombat')?.(combat);

		expectRefreshed(actor, 2);
	});

	it('does nothing when a combat that has not started is created or deleted', async () => {
		const hooks = await register();
		const actor = createActor();
		const combat = createCombat(false, [actor]);

		hooks.get('createCombat')?.(combat);
		hooks.get('deleteCombat')?.(combat);

		expectNotRefreshed(actor);
	});

	it('re-prepares the actor when a combatant joins or leaves a started combat', async () => {
		const hooks = await register();
		const actor = createActor();
		const combatant = { actor, parent: { started: true } };

		hooks.get('createCombatant')?.(combatant);
		hooks.get('deleteCombatant')?.(combatant);

		expectRefreshed(actor, 2);
	});

	it('does nothing when a combatant joins or leaves a combat that has not started', async () => {
		const hooks = await register();
		const actor = createActor();
		const combatant = { actor, parent: { started: false } };

		hooks.get('createCombatant')?.(combatant);
		hooks.get('deleteCombatant')?.(combatant);

		expectNotRefreshed(actor);
	});

	it('does nothing on any hook while Movement Tracking is off', async () => {
		isMovementTrackingEnabledMock.mockReturnValue(false);
		const hooks = await register();
		const actor = createActor();
		const combat = createCombat(true, [actor]);
		const combatant = { actor, parent: combat };

		hooks.get('recordToken')?.({ actor });
		hooks.get('updateCombat')?.(combat, { round: 1 });
		hooks.get('createCombat')?.(combat);
		hooks.get('deleteCombat')?.(combat);
		hooks.get('createCombatant')?.(combatant);
		hooks.get('deleteCombatant')?.(combatant);

		expectNotRefreshed(actor);
	});
});

describe('refreshMovementTrackedActors', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('re-prepares the combatant actors of started combats only, whatever the toggle', async () => {
		isMovementTrackingEnabledMock.mockReturnValue(false);
		const fighting = createActor();
		const waiting = createActor();
		(game as unknown as { combats: unknown }).combats = [
			createCombat(true, [fighting]),
			createCombat(false, [waiting]),
		];
		const { refreshMovementTrackedActors } = await import('./movementHistoryRefresh.js');

		refreshMovementTrackedActors();

		expectRefreshed(fighting);
		expectNotRefreshed(waiting);
	});
});
