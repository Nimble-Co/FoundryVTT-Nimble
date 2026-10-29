import { beforeEach, describe, expect, it, vi } from 'vitest';

const { applyEncounterRefillMock, endEncounterMarksMock, isActiveGMMock } = vi.hoisted(() => ({
	applyEncounterRefillMock: vi.fn(async () => undefined),
	endEncounterMarksMock: vi.fn(async () => undefined),
	isActiveGMMock: vi.fn(() => true),
}));

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	applyEncounterRefill: applyEncounterRefillMock,
}));
vi.mock('#utils/actor/markLifecycle.js', () => ({ endEncounterMarks: endEncounterMarksMock }));
vi.mock('#utils/isActiveGM.js', () => ({ isActiveGM: isActiveGMMock }));

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

function createCharacterActor(id: string) {
	return { id, type: 'character' } as Actor.Implementation;
}

function createCombat(combatId: string, actor: Actor.Implementation): Combat {
	return {
		id: combatId,
		combatants: { contents: [{ actor }], size: 1 },
	} as unknown as Combat;
}

describe('registerEncounterEndTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
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
	});

	it('registers both updateCombat and deleteCombat hooks', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		expect(hooks.get('updateCombat')).toBeDefined();
		expect(hooks.get('deleteCombat')).toBeDefined();
	});

	it('fires encounterEnd on combat end transition (started: false)', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		const actor = createCharacterActor('character-1');
		const combat = createCombat('combat-1', actor);
		hooks.get('updateCombat')?.(combat, { started: false });

		expect(applyEncounterRefillMock).toHaveBeenCalledTimes(1);
		expect(applyEncounterRefillMock).toHaveBeenCalledWith(actor, 'encounterEnd');
	});

	it('does not double-fire when updateCombat is followed by deleteCombat', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		const actor = createCharacterActor('character-2');
		const combat = createCombat('combat-2', actor);
		hooks.get('updateCombat')?.(combat, { started: false });
		hooks.get('deleteCombat')?.(combat);

		expect(applyEncounterRefillMock).toHaveBeenCalledTimes(1);
	});

	it('fires on deleteCombat alone as fallback', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		const actor = createCharacterActor('character-3');
		const combat = createCombat('combat-3', actor);
		hooks.get('deleteCombat')?.(combat);

		expect(applyEncounterRefillMock).toHaveBeenCalledTimes(1);
		expect(applyEncounterRefillMock).toHaveBeenCalledWith(actor, 'encounterEnd');
	});

	it('ends the marks that end with the encounter, on the active GM only', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();
		const actor = createCharacterActor('character-6');

		hooks.get('deleteCombat')?.(createCombat('combat-6', actor));
		expect(endEncounterMarksMock).toHaveBeenCalledWith(actor);

		endEncounterMarksMock.mockClear();
		isActiveGMMock.mockReturnValueOnce(false);
		hooks.get('deleteCombat')?.(createCombat('combat-7', actor));
		expect(endEncounterMarksMock).not.toHaveBeenCalled();
	});

	it('ignores updateCombat changes that are not end transitions', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		const actor = createCharacterActor('character-4');
		const combat = createCombat('combat-4', actor);
		hooks.get('updateCombat')?.(combat, { round: 3 });

		expect(applyEncounterRefillMock).not.toHaveBeenCalled();
	});

	it('skips non-character combatants', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		const npc = { id: 'npc-1', type: 'npc' } as Actor.Implementation;
		const combat = {
			id: 'combat-5',
			combatants: { contents: [{ actor: npc }], size: 1 },
		} as unknown as Combat;
		hooks.get('deleteCombat')?.(combat);

		expect(applyEncounterRefillMock).not.toHaveBeenCalled();
	});

	it('does not throw on empty combatant list', async () => {
		const hooks = captureHooks();
		const { registerEncounterEndTriggerHooks } = await import('../encounterEndTrigger.js');
		registerEncounterEndTriggerHooks();

		const combat = {
			id: 'combat-6',
			combatants: { contents: [], size: 0 },
		} as unknown as Combat;

		expect(() => hooks.get('deleteCombat')?.(combat)).not.toThrow();
		expect(applyEncounterRefillMock).not.toHaveBeenCalled();
	});
});
