import { describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../../tests/fixtures/combat.js';
import { getActionState } from './resources.utils.js';

function createCharacterCombatant(options: { pendingDelta?: number } = {}) {
	return createCombatantFixture({
		type: 'character',
		actor: createCombatActorFixture({ type: 'character' }),
		actionsCurrent: 2,
		actionsMax: 3,
		actionsPendingDelta: options.pendingDelta ?? 0,
	});
}

describe('getActionState', () => {
	it('reports no pending adjustment when none is stored', () => {
		expect(getActionState(createCharacterCombatant()).pendingDelta).toBe(0);
	});

	it('surfaces a pending gain so the tracker can mark it', () => {
		expect(getActionState(createCharacterCombatant({ pendingDelta: 2 })).pendingDelta).toBe(2);
	});

	it('surfaces a pending loss with its sign intact', () => {
		expect(getActionState(createCharacterCombatant({ pendingDelta: -1 })).pendingDelta).toBe(-1);
	});

	it('reports no pending adjustment for a non-character combatant', () => {
		// Only character combatants carry a pending pool, so a value stored on any
		// other combatant type must not reach the tracker.
		const monster = createCombatantFixture({ type: 'npc', actionsPendingDelta: 3 });
		expect(getActionState(monster).pendingDelta).toBe(0);
	});

	it('leaves the existing action figures untouched', () => {
		const state = getActionState(createCharacterCombatant({ pendingDelta: 1 }));
		expect(state).toMatchObject({ current: 2, max: 3, additional: 0, effectiveMax: 3 });
	});
});
