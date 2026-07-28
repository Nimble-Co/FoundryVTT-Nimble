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
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

function makeCombatant(type: string): Combatant.Implementation {
	return {
		id: `${type}-combatant`,
		type,
		actor: { id: `${type}-actor`, type },
	} as unknown as Combatant.Implementation;
}

describe('registerDicePoolTurnTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('registers both turn-boundary custom hooks', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerDicePoolTurnTriggerHooks } = await import('./turnTrigger.js');
		registerDicePoolTurnTriggerHooks();

		expect(callbacks.get('nimbleCombatTurnStart')).toBeDefined();
		expect(callbacks.get('nimbleCombatTurnEnd')).toBeDefined();
	});

	it('fires onTurnStart refill for a character combatant', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerDicePoolTurnTriggerHooks } = await import('./turnTrigger.js');
		registerDicePoolTurnTriggerHooks();

		const combatant = makeCombatant('character');
		callbacks.get('nimbleCombatTurnStart')?.(combatant);

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(
			(combatant as unknown as { actor: unknown }).actor,
			'onTurnStart',
		);
	});

	it('fires onTurnEnd refill for a character combatant', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerDicePoolTurnTriggerHooks } = await import('./turnTrigger.js');
		registerDicePoolTurnTriggerHooks();

		const combatant = makeCombatant('character');
		callbacks.get('nimbleCombatTurnEnd')?.(combatant);

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(
			(combatant as unknown as { actor: unknown }).actor,
			'onTurnEnd',
		);
	});

	it('ignores non-character combatants', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerDicePoolTurnTriggerHooks } = await import('./turnTrigger.js');
		registerDicePoolTurnTriggerHooks();

		callbacks.get('nimbleCombatTurnStart')?.(makeCombatant('npc'));
		callbacks.get('nimbleCombatTurnEnd')?.(makeCombatant('soloMonster'));

		expect(applyRefillToActorIfEligible).not.toHaveBeenCalled();
	});

	it('ignores combatants with no actor', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerDicePoolTurnTriggerHooks } = await import('./turnTrigger.js');
		registerDicePoolTurnTriggerHooks();

		const combatant = {
			id: 'orphan',
			type: 'character',
			actor: null,
		} as unknown as Combatant.Implementation;
		callbacks.get('nimbleCombatTurnStart')?.(combatant);

		expect(applyRefillToActorIfEligible).not.toHaveBeenCalled();
	});
});
