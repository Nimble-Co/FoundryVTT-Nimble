import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type CombatDefeatSyncTestGlobals,
	createHasPropertyMock,
	createHookCapture,
	createMockCombat,
	createMockCombatActor,
	createMockCombatant,
	getTestGlobals,
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

	it('marks character combatants defeated when wounds reach max without altering actions', async () => {
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
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});
	});

	it('restores character combatants when wounds drop below max without refilling actions', async () => {
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
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});

	it('does not restore character actions on hp-only updates while alive', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-2b',
			hp: 4,
			woundsValue: 2,
			woundsMax: 6,
		});
		const combatant = createMockCombatant({
			id: 'combatant-2b',
			type: 'character',
			actorId: 'actor-2b',
			actor,
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 3,
		});
		const combat = createMockCombat({
			id: 'combat-2b',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 3 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
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
			},
		]);
	});

	it('does not update actions when HP changes but defeat state does not change', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-6',
			hp: 7,
		});
		const combatant = createMockCombatant({
			id: 'combatant-6',
			type: 'npc',
			actorId: 'actor-6',
			actor,
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 3,
		});
		const combat = createMockCombat({
			id: 'combat-6',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 7 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});

	it('does not restore npc actions on hp updates while alive', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-3b',
			hp: 7,
			woundsValue: 0,
			woundsMax: 6,
		});
		const combatant = createMockCombatant({
			id: 'combatant-3b',
			type: 'npc',
			actorId: 'actor-3b',
			actor,
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 2,
		});
		const combat = createMockCombat({
			id: 'combat-3b',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 5 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('restores npc combatants when HP goes above 0', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-npc-recover',
			hp: 6,
		});
		const combatant = createMockCombatant({
			id: 'combatant-npc-recover',
			type: 'npc',
			actorId: 'actor-npc-recover',
			actor,
			defeated: true,
			actionsCurrent: 0,
			actionsMax: 2,
		});
		const combat = createMockCombat({
			id: 'combat-npc-recover',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 6 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-npc-recover',
				defeated: false,
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});

	it('re-applies dead status when HP returns to 0 after manual status removal', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-manual-removal',
			hp: 0,
		});
		// Combatant.defeated was manually set to false but HP is 0
		const combatant = createMockCombatant({
			id: 'combatant-manual-removal',
			type: 'npc',
			actorId: 'actor-manual-removal',
			actor,
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 2,
		});
		const combat = createMockCombat({
			id: 'combat-manual-removal',
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
				_id: 'combatant-manual-removal',
				defeated: true,
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});
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

	it('toggles defeated status on actor outside of combat when HP reaches 0', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-no-combat',
			type: 'npc',
			hp: 0,
		});

		// No combatants in any combat
		globals().game.combats.contents = [];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		// Should toggle status on the actor even without a combatant
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});
	});

	it('removes defeated status on actor outside of combat when HP goes above 0', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createMockCombatActor({
			id: 'actor-no-combat-recover',
			type: 'npc',
			hp: 5,
		});

		// No combatants in any combat
		globals().game.combats.contents = [];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 5 } } } });
		await flushAsync();

		// Should toggle status off on the actor
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});

	it('toggles status effect on triggering actor even when identity check fails', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		// Create two different actor objects with the same id to simulate identity check failure
		// This can happen in Foundry when combatant.actor returns a different object reference
		const triggeringActor = createMockCombatActor({
			id: 'actor-identity-fail',
			hp: 0,
		});
		const combatantActor = createMockCombatActor({
			id: 'actor-identity-fail',
			hp: 0,
		});

		const combatant = createMockCombatant({
			id: 'combatant-identity-fail',
			type: 'npc',
			actorId: 'actor-identity-fail',
			actor: combatantActor, // Different object reference than triggeringActor
			defeated: false,
		});
		const combat = createMockCombat({
			id: 'combat-identity-fail',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		// Pass triggeringActor (different object than combatant.actor)
		updateActor?.(triggeringActor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		// Should still update combatant defeated flag
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-identity-fail',
				defeated: true,
			},
		]);
		// Should toggle status on the triggering actor via fallback
		expect(triggeringActor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});
	});

	it('only marks defeated status on the specific token actor when multiple unlinked tokens share same base actor id', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		// Simulate unlinked tokens: same actorId but different actor instances (synthetic actors)
		const deadTokenActor = createMockCombatActor({
			id: 'base-goblin-actor',
			hp: 0,
		});
		const aliveTokenActor1 = createMockCombatActor({
			id: 'base-goblin-actor',
			hp: 10,
		});
		const aliveTokenActor2 = createMockCombatActor({
			id: 'base-goblin-actor',
			hp: 8,
		});

		const deadGoblin = createMockCombatant({
			id: 'goblin-combatant-1',
			type: 'npc',
			actorId: 'base-goblin-actor',
			actor: deadTokenActor,
			defeated: false,
		});
		const aliveGoblin1 = createMockCombatant({
			id: 'goblin-combatant-2',
			type: 'npc',
			actorId: 'base-goblin-actor',
			actor: aliveTokenActor1,
			defeated: false,
		});
		const aliveGoblin2 = createMockCombatant({
			id: 'goblin-combatant-3',
			type: 'npc',
			actorId: 'base-goblin-actor',
			actor: aliveTokenActor2,
			defeated: false,
		});

		const combat = createMockCombat({
			id: 'combat-unlinked',
			combatants: [deadGoblin, aliveGoblin1, aliveGoblin2],
			turns: [deadGoblin, aliveGoblin1, aliveGoblin2],
			activeCombatant: aliveGoblin1,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(deadTokenActor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		// Only the dead goblin's combatant should be marked defeated
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'goblin-combatant-1', defeated: true },
		]);

		// The dead token's actor should have defeated status enabled
		expect(deadTokenActor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});

		// The alive token actors should have defeated status disabled (not enabled!)
		expect(aliveTokenActor1.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
		expect(aliveTokenActor2.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});
});
