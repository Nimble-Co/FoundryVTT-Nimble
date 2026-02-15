import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createHasPropertyMock,
	createHookCapture,
	createMockCombat,
	createMockCombatActor,
	createMockCombatant,
	getTestGlobals,
	type CombatDefeatSyncTestGlobals,
} from '../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

async function flushAsync() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('registerCombatantDefeatSync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.combats = { contents: [] };
		globals().foundry.utils.hasProperty = createHasPropertyMock();
		globals().CONFIG.specialStatusEffects = {
			DEFEATED: 'defeated',
		};
	});

	it('marks character combatants defeated when wounds reach max and clears actions', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-1',
			hp: 0,
			woundsValue: 6,
			woundsMax: 6,
		});
		const combatant = createMockCombatant({
			id: 'combatant-1',
			type: 'character',
			actorId: 'actor-1',
			actor,
			defeated: false,
			actionsCurrent: 2,
			actionsMax: 3,
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		expect(updateActor).toBeDefined();
		updateActor?.(actor, { system: { attributes: { wounds: { value: 6 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-1',
				defeated: true,
				'system.actions.base.current': 0,
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});
	});

	it('restores character combatants when wounds drop below max', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-2',
			hp: 1,
			woundsValue: 2,
			woundsMax: 6,
		});
		const combatant = createMockCombatant({
			id: 'combatant-2',
			type: 'character',
			actorId: 'actor-2',
			actor,
			defeated: true,
			actionsCurrent: 0,
			actionsMax: 3,
		});
		const combat = createMockCombat({
			id: 'combat-2',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { wounds: { value: 2 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-2',
				defeated: false,
				'system.actions.base.current': 3,
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});

	it('uses HP logic for non-character combatants', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-3',
			hp: 0,
			woundsValue: 0,
			woundsMax: 6,
		});
		const combatant = createMockCombatant({
			id: 'combatant-3',
			type: 'npc',
			actorId: 'actor-3',
			actor,
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 1,
		});
		const combat = createMockCombat({
			id: 'combat-3',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-3',
				defeated: true,
				'system.actions.base.current': 0,
			},
		]);
	});

	it('advances turn when active combatant becomes defeated and others are alive', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-4',
			hp: 0,
			woundsValue: 6,
			woundsMax: 6,
		});
		const deadCombatant = createMockCombatant({
			id: 'combatant-4a',
			type: 'character',
			actorId: 'actor-4',
			actor,
			defeated: false,
			actionsCurrent: 2,
			actionsMax: 2,
		});
		const aliveOther = createMockCombatant({
			id: 'combatant-4b',
			type: 'npc',
			actorId: 'other-actor',
			actor: createMockCombatActor({ id: 'other-actor', hp: 10 }),
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 1,
		});
		const combat = createMockCombat({
			id: 'combat-4',
			combatants: [deadCombatant, aliveOther],
			turns: [deadCombatant, aliveOther],
			activeCombatant: deadCombatant,
			round: 2,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { wounds: { value: 6 } } } });
		await flushAsync();

		expect(combat.nextTurn).toHaveBeenCalledTimes(1);
	});

	it('does not advance turn at round 0 even when active combatant becomes defeated', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-5',
			hp: 0,
			woundsValue: 6,
			woundsMax: 6,
		});
		const deadCombatant = createMockCombatant({
			id: 'combatant-5a',
			type: 'character',
			actorId: 'actor-5',
			actor,
			defeated: false,
			actionsCurrent: 2,
			actionsMax: 2,
		});
		const aliveOther = createMockCombatant({
			id: 'combatant-5b',
			type: 'npc',
			actorId: 'other-actor-5',
			actor: createMockCombatActor({ id: 'other-actor-5', hp: 8 }),
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 1,
		});
		const combat = createMockCombat({
			id: 'combat-5',
			combatants: [deadCombatant, aliveOther],
			turns: [deadCombatant, aliveOther],
			activeCombatant: deadCombatant,
			round: 0,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { wounds: { max: 6 } } } });
		await flushAsync();

		expect(combat.nextTurn).not.toHaveBeenCalled();
	});
});
