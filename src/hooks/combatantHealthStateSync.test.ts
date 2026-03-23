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

	it('applies bloodied before last stand is reached', async () => {
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

	it('keeps solo monsters in last stand after the state has already been triggered', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 8,
				hpMax: 20,
				lastStandThreshold: 3,
			}),
			{ statuses: new Set(['lastStand']) },
		);

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, {
			system: { attributes: { hp: { value: 8, lastStandThreshold: 3 } } },
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

	describe('createCombatant hook', () => {
		it('syncs health state when combatant is created with bloodied actor', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
				.default;
			registerCombatantHealthStateSync();

			const actor = createMockCombatActor({
				type: 'npc',
				hp: 5,
				hpMax: 10,
			});

			const createCombatant = callbacks.get('createCombatant');
			expect(createCombatant).toBeDefined();

			const combatant = { actor } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
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

		it('syncs health state when combatant is created with healthy actor', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
				.default;
			registerCombatantHealthStateSync();

			const actor = createMockCombatActor({
				type: 'npc',
				hp: 10,
				hpMax: 10,
			});

			const createCombatant = callbacks.get('createCombatant');

			const combatant = { actor } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
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

		it('syncs health state when combatant is created with last stand solo monster', async () => {
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

			const createCombatant = callbacks.get('createCombatant');

			const combatant = { actor } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
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

		it('does nothing when combatant has no actor', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
				.default;
			registerCombatantHealthStateSync();

			const createCombatant = callbacks.get('createCombatant');

			const combatant = { actor: null } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
			await flushAsync();

			// No errors should occur, and no status effects should be toggled
		});

		it('only affects the specific combatant actor, not other unlinked tokens', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
				.default;
			registerCombatantHealthStateSync();

			// Actor for the new combatant (bloodied)
			const newActor = createMockCombatActor({
				id: 'base-goblin',
				type: 'npc',
				hp: 5,
				hpMax: 10,
			});

			// Actor for an existing combatant (healthy, same base actor ID)
			const existingActor = createMockCombatActor({
				id: 'base-goblin',
				type: 'npc',
				hp: 10,
				hpMax: 10,
			});

			const createCombatant = callbacks.get('createCombatant');

			// Only pass the new combatant to the hook
			const combatant = { actor: newActor } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
			await flushAsync();

			// New actor should have bloodied applied
			expect(newActor.toggleStatusEffect).toHaveBeenNthCalledWith(1, 'bloodied', {
				active: true,
				overlay: false,
			});

			// Existing actor should NOT be affected
			expect(existingActor.toggleStatusEffect).not.toHaveBeenCalled();
		});
	});
});
