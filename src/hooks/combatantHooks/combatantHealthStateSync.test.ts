import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync, getTestGlobals } from '../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHasPropertyMock,
	createHookCapture,
	createMockCombatActor,
} from '../../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

describe('registerCombatantHealthStateSync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.combats = { contents: [] };
		globals().foundry.utils.hasProperty = createHasPropertyMock();
	});

	it('toggles bloodied on for actors at or below half HP', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({ type: 'npc', hp: 5, hpMax: 10 });

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 5 } } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
			active: true,
			overlay: false,
		});
		// Last Stand is never auto-toggled by sync (one-way, set only via tryEnterLastStand).
		expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('lastStand', expect.anything());
	});

	it('toggles bloodied off when healed above half HP', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({ type: 'npc', hp: 8, hpMax: 10 });

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 8 } } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
			active: false,
			overlay: false,
		});
	});

	it('enters Last Stand when HP hits 0 with lastStandHp configured', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const activateLastStandFeature = vi.fn().mockResolvedValue(null);
		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 0,
				hpMax: 320,
				lastStandHp: 180,
			}),
			{ activateLastStandFeature },
		);

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 180,
		});
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('lastStand', {
			active: true,
			overlay: false,
		});
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dying', {
			active: true,
			overlay: false,
		});
		expect(activateLastStandFeature).toHaveBeenCalledWith({ visibilityMode: 'gmroll' });
	});

	it('also applies bloodied on entry when lastStandHp is at or below half maxHp', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		// Mutate hp.value when actor.update is called so the post-heal bloodied check
		// sees the new value, mirroring real Foundry document update behavior.
		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 0,
				hpMax: 320,
				lastStandHp: 100,
			}),
			{ activateLastStandFeature: vi.fn().mockResolvedValue(null) },
		);
		actor.update.mockImplementation(async (changes: Record<string, unknown>) => {
			const value = changes['system.attributes.hp.value'];
			if (typeof value === 'number') {
				(
					actor as unknown as { system: { attributes: { hp: { value: number } } } }
				).system.attributes.hp.value = value;
			}
		});

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('lastStand', {
			active: true,
			overlay: false,
		});
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
			active: true,
			overlay: false,
		});
	});

	it('does NOT apply bloodied on entry when lastStandHp is above half maxHp', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 0,
				hpMax: 320,
				lastStandHp: 200,
			}),
			{ activateLastStandFeature: vi.fn().mockResolvedValue(null) },
		);
		actor.update.mockImplementation(async (changes: Record<string, unknown>) => {
			const value = changes['system.attributes.hp.value'];
			if (typeof value === 'number') {
				(
					actor as unknown as { system: { attributes: { hp: { value: number } } } }
				).system.attributes.hp.value = value;
			}
		});

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
			active: false,
			overlay: false,
		});
	});

	it('clamps the heal target to maxHp when lastStandHp exceeds it', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 0,
				hpMax: 50,
				lastStandHp: 999,
			}),
			{ activateLastStandFeature: vi.fn().mockResolvedValue(null) },
		);

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		expect(actor.update).toHaveBeenCalledWith({
			'system.attributes.hp.value': 50,
		});
	});

	it('does NOT re-enter Last Stand once the status is already set', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const activateLastStandFeature = vi.fn().mockResolvedValue(null);
		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 0,
				hpMax: 320,
				lastStandHp: 180,
			}),
			{ statuses: new Set(['lastStand']), activateLastStandFeature },
		);

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		// No heal-back update, no chat re-fire.
		expect(actor.update).not.toHaveBeenCalled();
		expect(activateLastStandFeature).not.toHaveBeenCalled();
		// Bloodied sync still runs.
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith(
			'bloodied',
			expect.objectContaining({ active: false }),
		);
	});

	it('keeps the Last Stand status while healing above the threshold (one-way)', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = Object.assign(
			createMockCombatActor({
				type: 'soloMonster',
				hp: 250,
				hpMax: 320,
				lastStandHp: 180,
			}),
			{ statuses: new Set(['lastStand']) },
		);

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 250 } } } });
		await flushAsync();

		// Status is never auto-cleared. Bloodied is updated independently.
		expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('lastStand', expect.anything());
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
			active: false,
			overlay: false,
		});
	});

	it('ignores actor updates that do not touch HP state inputs', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
			.default;
		registerCombatantHealthStateSync();

		const actor = createMockCombatActor({ type: 'npc', hp: 10, hpMax: 10 });

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { details: { level: 2 } } });
		await flushAsync();

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	describe('createCombatant hook', () => {
		it('syncs bloodied when combatant is created with bloodied actor', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
				.default;
			registerCombatantHealthStateSync();

			const actor = createMockCombatActor({ type: 'npc', hp: 5, hpMax: 10 });

			const createCombatant = callbacks.get('createCombatant');
			expect(createCombatant).toBeDefined();

			const combatant = { actor } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
			await flushAsync();

			expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
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
		});

		it('only affects the specific combatant actor, not other unlinked tokens', async () => {
			const callbacks = createHookCapture(globals().Hooks.on);
			const registerCombatantHealthStateSync = (await import('./combatantHealthStateSync.js'))
				.default;
			registerCombatantHealthStateSync();

			const newActor = createMockCombatActor({
				id: 'base-goblin',
				type: 'npc',
				hp: 5,
				hpMax: 10,
			});

			const existingActor = createMockCombatActor({
				id: 'base-goblin',
				type: 'npc',
				hp: 10,
				hpMax: 10,
			});

			const createCombatant = callbacks.get('createCombatant');

			const combatant = { actor: newActor } as unknown as Combatant.Implementation;
			createCombatant?.(combatant);
			await flushAsync();

			expect(newActor.toggleStatusEffect).toHaveBeenCalledWith('bloodied', {
				active: true,
				overlay: false,
			});

			expect(existingActor.toggleStatusEffect).not.toHaveBeenCalled();
		});
	});
});
