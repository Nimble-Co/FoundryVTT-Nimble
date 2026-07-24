import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearBankedDamageReductionMock, isActiveGMMock } = vi.hoisted(() => ({
	clearBankedDamageReductionMock: vi.fn(async () => undefined),
	isActiveGMMock: vi.fn(() => true),
}));

vi.mock('#utils/bankedDamageReduction.js', () => ({
	clearBankedDamageReduction: clearBankedDamageReductionMock,
}));

vi.mock('#utils/isActiveGM.js', () => ({
	isActiveGM: isActiveGMMock,
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

function createCombat(combatId: string, actors: object[]): Combat {
	return {
		id: combatId,
		combatants: {
			contents: actors.map((actor) => ({ actor })),
			size: actors.length,
		},
	} as unknown as Combat;
}

describe('registerBankedDamageReductionExpiryHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		isActiveGMMock.mockReturnValue(true);
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
				hasProperty: (object: unknown, path: string) =>
					typeof object === 'object' && object !== null
						? getProperty(object, path) !== undefined
						: false,
			},
		};
	});

	async function register(hooks: HookCallbackMap) {
		const { registerBankedDamageReductionExpiryHooks } = await import(
			'./bankedDamageReductionExpiry.js'
		);
		registerBankedDamageReductionExpiryHooks();
		return hooks;
	}

	it('clears every combatant bank when combat ends via updateCombat', async () => {
		const hooks = await register(captureHooks());
		const actorA = { id: 'a' };
		const actorB = { id: 'b' };
		hooks.get('updateCombat')?.(createCombat('combat-1', [actorA, actorB]), { started: false });

		expect(clearBankedDamageReductionMock).toHaveBeenCalledTimes(2);
		expect(clearBankedDamageReductionMock).toHaveBeenCalledWith(actorA);
		expect(clearBankedDamageReductionMock).toHaveBeenCalledWith(actorB);
	});

	it('clears banks on deleteCombat when no updateCombat end fired', async () => {
		const hooks = await register(captureHooks());
		const actor = { id: 'a' };
		hooks.get('deleteCombat')?.(createCombat('combat-2', [actor]));

		expect(clearBankedDamageReductionMock).toHaveBeenCalledTimes(1);
	});

	it('does not double-clear when updateCombat is followed by deleteCombat', async () => {
		const hooks = await register(captureHooks());
		const combat = createCombat('combat-3', [{ id: 'a' }]);
		hooks.get('updateCombat')?.(combat, { started: false });
		hooks.get('deleteCombat')?.(combat);

		expect(clearBankedDamageReductionMock).toHaveBeenCalledTimes(1);
	});

	it('ignores updateCombat changes that are not an end transition', async () => {
		const hooks = await register(captureHooks());
		const combat = createCombat('combat-4', [{ id: 'a' }]);
		hooks.get('updateCombat')?.(combat, { round: 2 });
		hooks.get('updateCombat')?.(combat, { started: true });

		expect(clearBankedDamageReductionMock).not.toHaveBeenCalled();
	});

	it('does nothing on clients that are not the active GM', async () => {
		isActiveGMMock.mockReturnValue(false);
		const hooks = await register(captureHooks());
		const combat = createCombat('combat-5', [{ id: 'a' }]);
		hooks.get('updateCombat')?.(combat, { started: false });
		hooks.get('deleteCombat')?.(combat);

		expect(clearBankedDamageReductionMock).not.toHaveBeenCalled();
	});
});
