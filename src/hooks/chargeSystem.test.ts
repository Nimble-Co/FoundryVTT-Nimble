import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	applyEncounterRecoveryMock,
	applyRestRecoveryMock,
	consumeOnResolvedItemUseMock,
	isChargePoolFlagUpdateMock,
	syncActorPoolsMock,
	validateItemChargeConsumptionMock,
} = vi.hoisted(() => ({
	applyEncounterRecoveryMock: vi.fn(async () => undefined),
	applyRestRecoveryMock: vi.fn(async () => undefined),
	consumeOnResolvedItemUseMock: vi.fn(async () => ({ ok: true })),
	isChargePoolFlagUpdateMock: vi.fn(() => false),
	syncActorPoolsMock: vi.fn(async () => undefined),
	validateItemChargeConsumptionMock: vi.fn(() => ({ ok: true })),
}));

vi.mock('#utils/chargePool/chargePoolConsume.js', () => ({
	validateItemChargeConsumption: validateItemChargeConsumptionMock,
	consumeOnResolvedItemUse: consumeOnResolvedItemUseMock,
}));

vi.mock('#utils/chargePool/chargePoolRecover.js', () => ({
	applyRestRecovery: applyRestRecoveryMock,
	applyEncounterRecovery: applyEncounterRecoveryMock,
}));

vi.mock('#utils/chargePool/chargePoolSync.js', () => ({
	isChargePoolFlagUpdate: isChargePoolFlagUpdateMock,
	syncActorPools: syncActorPoolsMock,
}));

vi.mock('#utils/localize.js', () => ({
	default: (key: string) => key,
}));

type HookCallback = (...args: unknown[]) => unknown;
type HookCallbackMap = Map<string, HookCallback>;

function captureHooks(): HookCallbackMap {
	const hooks = new Map<string, HookCallback>();
	(globalThis as unknown as { Hooks: { on: ReturnType<typeof vi.fn> } }).Hooks = {
		on: vi.fn((event: string, callback: HookCallback) => {
			hooks.set(event, callback);
			return 1;
		}),
	};
	return hooks;
}

function createActor(id: string, type: string = 'character') {
	return { id, type } as Actor.Implementation;
}

function createCombat(combatId: string, actor: Actor.Implementation, started: boolean): Combat {
	return {
		id: combatId,
		started,
		round: started ? 1 : 0,
		combatants: {
			contents: [{ actor }],
			size: 1,
		},
	} as unknown as Combat;
}

describe('registerChargeSystemHooks encounter recovery hooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		(globalThis as unknown as { ui: { notifications: { error: ReturnType<typeof vi.fn> } } }).ui = {
			notifications: {
				error: vi.fn(),
			},
		};
		const getProperty = foundry.utils.getProperty;
		(
			globalThis as unknown as {
				foundry: {
					utils: {
						getProperty: typeof foundry.utils.getProperty;
						hasProperty: typeof foundry.utils.hasProperty;
					};
				};
			}
		).foundry = {
			utils: {
				getProperty,
				hasProperty: ((object: unknown, path: string) =>
					typeof object === 'object' && object !== null
						? getProperty(object, path) !== undefined
						: false) as unknown as typeof foundry.utils.hasProperty,
			},
		};
		(globalThis as unknown as { game: { combat: Combat | null } }).game = {
			combat: null,
		};
	});

	it('does not apply encounter-end recovery on pre-start combat updates', async () => {
		const hooks = captureHooks();
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const updateCombatHook = hooks.get('updateCombat');
		expect(updateCombatHook).toBeDefined();

		const actor = createActor('actor-1');
		const combat = createCombat('combat-1', actor, false);
		updateCombatHook?.(combat, { round: 0 });

		expect(applyEncounterRecoveryMock).not.toHaveBeenCalled();
	});

	it('applies encounter-end recovery exactly once on combat end transition', async () => {
		const hooks = captureHooks();
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const updateCombatHook = hooks.get('updateCombat');
		expect(updateCombatHook).toBeDefined();

		const actor = createActor('actor-2');
		const combat = createCombat('combat-2', actor, false);
		updateCombatHook?.(combat, { started: false });

		expect(applyEncounterRecoveryMock).toHaveBeenCalledTimes(1);
		expect(applyEncounterRecoveryMock).toHaveBeenCalledWith(actor, 'encounterEnd');
	});

	it('does not double-apply encounter-end recovery when combat is later deleted', async () => {
		const hooks = captureHooks();
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const updateCombatHook = hooks.get('updateCombat');
		const deleteCombatHook = hooks.get('deleteCombat');
		expect(updateCombatHook).toBeDefined();
		expect(deleteCombatHook).toBeDefined();

		const actor = createActor('actor-3');
		const combat = createCombat('combat-3', actor, false);
		updateCombatHook?.(combat, { started: false });
		deleteCombatHook?.(combat);

		expect(applyEncounterRecoveryMock).toHaveBeenCalledTimes(1);
		expect(applyEncounterRecoveryMock).toHaveBeenCalledWith(actor, 'encounterEnd');
	});

	it('keeps deleteCombat as fallback when no end transition update was received', async () => {
		const hooks = captureHooks();
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const deleteCombatHook = hooks.get('deleteCombat');
		expect(deleteCombatHook).toBeDefined();

		const actor = createActor('actor-4');
		const combat = createCombat('combat-4', actor, false);
		deleteCombatHook?.(combat);

		expect(applyEncounterRecoveryMock).toHaveBeenCalledTimes(1);
		expect(applyEncounterRecoveryMock).toHaveBeenCalledWith(actor, 'encounterEnd');
	});
});

describe('registerChargeSystemHooks resource-spending automation gate', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		(globalThis as unknown as { game: Record<string, unknown> }).game = { combat: null };
	});

	function setSpendingAutomation(enabled: boolean): void {
		(globalThis as unknown as { game: Record<string, unknown> }).game.settings = {
			get: vi.fn(() => enabled),
		};
	}

	function createCharacterItem(): unknown {
		return { name: 'Wand of Charges', actor: { type: 'character' } };
	}

	it('validates and consumes charges when spending automation is on', async () => {
		const hooks = captureHooks();
		setSpendingAutomation(true);
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const item = createCharacterItem();
		expect(hooks.get('nimble.preUseItem')?.(item)).toBe(true);
		expect(validateItemChargeConsumptionMock).toHaveBeenCalledTimes(1);

		hooks.get('nimble.useItem')?.(item, null, {});
		expect(consumeOnResolvedItemUseMock).toHaveBeenCalledTimes(1);
	});

	it('skips validation and consumption but allows the use when spending automation is off', async () => {
		const hooks = captureHooks();
		setSpendingAutomation(false);
		const registerChargeSystemHooks = (await import('./chargeSystem.js')).default;
		registerChargeSystemHooks();

		const item = createCharacterItem();
		expect(hooks.get('nimble.preUseItem')?.(item)).toBe(true);
		expect(validateItemChargeConsumptionMock).not.toHaveBeenCalled();

		hooks.get('nimble.useItem')?.(item, null, {});
		expect(consumeOnResolvedItemUseMock).not.toHaveBeenCalled();
	});
});
