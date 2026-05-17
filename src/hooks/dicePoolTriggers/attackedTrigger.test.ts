import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHookCapture,
} from '../../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<
		CombatDefeatSyncTestGlobals & { game: { combat: Combat | null; user: { isGM: boolean } } }
	>();
}

describe('registerAttackedTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		globals().game.combat = null;
	});

	it('registers nimble.damageApplied hook for incoming-damage detection', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('./attackedTrigger.js');
		registerAttackedTriggerHooks();

		const damageHook = callbacks.get('nimble.damageApplied');
		expect(damageHook).toBeDefined();
	});

	it('does not throw when target is not a character', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('./attackedTrigger.js');
		registerAttackedTriggerHooks();

		const npcTarget = {
			id: 'npc-target',
			type: 'npc',
			name: 'Goblin',
		} as unknown as Actor.Implementation;

		const damageHook = callbacks.get('nimble.damageApplied');
		let threw = false;
		try {
			damageHook?.({ targetActor: npcTarget });
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});

	it('does not throw when payload has no target', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('./attackedTrigger.js');
		registerAttackedTriggerHooks();

		const damageHook = callbacks.get('nimble.damageApplied');
		let threw = false;
		try {
			damageHook?.({});
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});
