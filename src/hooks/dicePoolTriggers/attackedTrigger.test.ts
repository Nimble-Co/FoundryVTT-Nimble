import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHookCapture,
} from '../../../tests/mocks/combat.js';

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	applyRefillToActorIfEligible: vi.fn(async () => {}),
}));

import { applyRefillToActorIfEligible } from '#utils/dicePool/dicePoolRefill.js';

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

	it('fires onAttacked but not onCritReceived for a normal hit', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('./attackedTrigger.js');
		registerAttackedTriggerHooks();

		const target = { id: 'hero', type: 'character' } as unknown as Actor.Implementation;
		callbacks.get('nimble.damageApplied')?.({ targetActor: target, isCritical: false });

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onAttacked');
		expect(applyRefillToActorIfEligible).not.toHaveBeenCalledWith(target, 'onCritReceived');
	});

	it('fires onCritReceived in addition to onAttacked for a critical hit', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('./attackedTrigger.js');
		registerAttackedTriggerHooks();

		const target = { id: 'hero', type: 'character' } as unknown as Actor.Implementation;
		callbacks.get('nimble.damageApplied')?.({ targetActor: target, isCritical: true });

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onAttacked');
		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onCritReceived');
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
