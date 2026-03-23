import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type CombatDefeatSyncTestGlobals,
	createHookCapture,
	createMockCombat,
	createMockCombatant,
} from '../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

function getTestGlobals<T>() {
	return globalThis as unknown as T;
}

async function flushAsync() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('registerTokenCombatantSync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.combats = { contents: [] };
	});

	it('removes combatant when its token is deleted', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');
		expect(deleteToken).toBeDefined();

		const token = {
			id: 'token-1',
			parent: { id: 'scene-1' },
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat.deleteEmbeddedDocuments).toHaveBeenCalledWith('Combatant', ['combatant-1']);
	});

	it('does not remove combatants from different scenes', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');

		// Delete token from a different scene
		const token = {
			id: 'token-1',
			parent: { id: 'scene-2' },
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('does not remove combatants with different token IDs', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');

		// Delete a different token
		const token = {
			id: 'token-2',
			parent: { id: 'scene-1' },
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('removes multiple combatants from multiple combats for the same token', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant1 = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combatant2 = createMockCombatant({
			id: 'combatant-2',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat1 = createMockCombat({
			id: 'combat-1',
			combatants: [combatant1],
			turns: [combatant1],
			activeCombatant: combatant1,
			round: 1,
		});
		const combat2 = createMockCombat({
			id: 'combat-2',
			combatants: [combatant2],
			turns: [combatant2],
			activeCombatant: combatant2,
			round: 1,
		});

		globals().game.combats.contents = [combat1, combat2];

		const deleteToken = callbacks.get('deleteToken');
		const token = {
			id: 'token-1',
			parent: { id: 'scene-1' },
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat1.deleteEmbeddedDocuments).toHaveBeenCalledWith('Combatant', ['combatant-1']);
		expect(combat2.deleteEmbeddedDocuments).toHaveBeenCalledWith('Combatant', ['combatant-2']);
	});

	it('does nothing when user is not GM', async () => {
		globals().game.user = { isGM: false };

		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');
		const token = {
			id: 'token-1',
			parent: { id: 'scene-1' },
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('does nothing when token has no id', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');
		const token = {
			id: null,
			parent: { id: 'scene-1' },
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('does nothing when token has no parent scene', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		const combatant = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');
		const token = {
			id: 'token-1',
			parent: null,
		};
		deleteToken?.(token);
		await flushAsync();

		expect(combat.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('batches multiple combatants in the same combat into a single delete call', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const registerTokenCombatantSync = (await import('./tokenCombatantSync.js')).default;
		registerTokenCombatantSync();

		// Two combatants with the same tokenId in the same combat (edge case, but possible)
		const combatant1 = createMockCombatant({
			id: 'combatant-1',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combatant2 = createMockCombatant({
			id: 'combatant-2',
			tokenId: 'token-1',
			sceneId: 'scene-1',
		});
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant1, combatant2],
			turns: [combatant1, combatant2],
			activeCombatant: combatant1,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const deleteToken = callbacks.get('deleteToken');
		const token = {
			id: 'token-1',
			parent: { id: 'scene-1' },
		};
		deleteToken?.(token);
		await flushAsync();

		// Should batch both combatants into a single delete call
		expect(combat.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(combat.deleteEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			'combatant-1',
			'combatant-2',
		]);
	});
});
