import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync, getTestGlobals } from '../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHookCapture,
	createMockCombat,
	createMockCombatant,
} from '../../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

function createDyingEffect(actorId: string) {
	return {
		parent: { documentName: 'Actor', id: actorId },
		statuses: new Set(['dying']),
	} as unknown as ActiveEffect.Implementation;
}

describe('registerDyingActionLimitSync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.combats = { contents: [] };
	});

	it('clamps current actions to 1 and clears additional actions when an actor becomes Dying', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const register = (await import('./dyingActionLimitSync.js')).default;
		register();

		const combatant = createMockCombatant({ id: 'c1', actorId: 'actor-1', actionsCurrent: 3 });
		(
			combatant.system as unknown as { actions: { base: { additional: number } } }
		).actions.base.additional = 2;
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});
		globals().game.combats = { contents: [combat] };

		const createActiveEffect = callbacks.get('createActiveEffect');
		createActiveEffect?.(createDyingEffect('actor-1'));
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'c1',
				'system.actions.base.current': 1,
				'system.actions.base.additional': 0,
			},
		]);
	});

	it('does not update when the combatant is already within the Dying limit', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const register = (await import('./dyingActionLimitSync.js')).default;
		register();

		const combatant = createMockCombatant({ id: 'c1', actorId: 'actor-1', actionsCurrent: 1 });
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});
		globals().game.combats = { contents: [combat] };

		const createActiveEffect = callbacks.get('createActiveEffect');
		createActiveEffect?.(createDyingEffect('actor-1'));
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('ignores active effects that are not the Dying status', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const register = (await import('./dyingActionLimitSync.js')).default;
		register();

		const combatant = createMockCombatant({ id: 'c1', actorId: 'actor-1', actionsCurrent: 3 });
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});
		globals().game.combats = { contents: [combat] };

		const createActiveEffect = callbacks.get('createActiveEffect');
		createActiveEffect?.({
			parent: { documentName: 'Actor', id: 'actor-1' },
			statuses: new Set(['bloodied']),
		} as unknown as ActiveEffect.Implementation);
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('does nothing for non-GM users', async () => {
		globals().game.user = { isGM: false };
		const callbacks = createHookCapture(globals().Hooks.on);
		const register = (await import('./dyingActionLimitSync.js')).default;
		register();

		const combatant = createMockCombatant({ id: 'c1', actorId: 'actor-1', actionsCurrent: 3 });
		const combat = createMockCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});
		globals().game.combats = { contents: [combat] };

		const createActiveEffect = callbacks.get('createActiveEffect');
		createActiveEffect?.(createDyingEffect('actor-1'));
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
