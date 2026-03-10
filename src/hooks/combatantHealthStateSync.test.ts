import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type CombatDefeatSyncTestGlobals,
	createHasPropertyMock,
	createHookCapture,
	createMockCombatActor,
	getTestGlobals,
} from '../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

async function flushAsync() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('registerCombatantHealthStateSync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.combats = { contents: [] };
		globals().foundry.utils.hasProperty = createHasPropertyMock();
	});

	it('applies bloodied and clears last stand when an actor becomes bloodied', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({
			type: 'npc',
			hp: 5,
			hpMax: 10,
		});

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 5 } } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(1, 'bloodied', {
			active: true,
			overlay: false,
		});
		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(2, 'lastStand', {
			active: false,
			overlay: false,
		});
	});

	it('applies last stand and clears bloodied for solo monsters at their threshold', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({
			type: 'soloMonster',
			hp: 3,
			hpMax: 20,
			lastStandThreshold: 3,
		});

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, {
			system: { attributes: { hp: { value: 3, lastStandThreshold: 3 } } },
		});
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(1, 'bloodied', {
			active: false,
			overlay: false,
		});
		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(2, 'lastStand', {
			active: true,
			overlay: false,
		});
	});

	it('clears bloodied and last stand when an actor reaches 0 HP', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({
			type: 'soloMonster',
			hp: 0,
			hpMax: 20,
			lastStandThreshold: 3,
		});

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, {
			system: { attributes: { hp: { value: 0, lastStandThreshold: 3 } } },
		});
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(1, 'bloodied', {
			active: false,
			overlay: false,
		});
		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(2, 'lastStand', {
			active: false,
			overlay: false,
		});
	});

	it('ignores actor updates that do not touch HP state inputs', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({
			type: 'npc',
			hp: 10,
			hpMax: 10,
		});

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { details: { level: 2 } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});
