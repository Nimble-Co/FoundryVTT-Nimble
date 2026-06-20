import { describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../tests/fixtures/combat.js';
import {
	getCombatantEffectiveMax,
	getCombatantResetActions,
	isCombatantDying,
} from './combatantSystem.js';

function createDyingActor() {
	return Object.assign(createCombatActorFixture({ type: 'character' }), {
		statuses: new Set(['dying']),
	}) as Actor.Implementation;
}

describe('isCombatantDying', () => {
	it('is true when the combatant actor has the dying status', () => {
		const combatant = createCombatantFixture({ actor: createDyingActor() });
		expect(isCombatantDying(combatant)).toBe(true);
	});

	it('is false when the combatant actor is not dying', () => {
		const combatant = createCombatantFixture({
			actor: createCombatActorFixture({ type: 'character' }),
		});
		expect(isCombatantDying(combatant)).toBe(false);
	});

	it('is false when the combatant has no actor', () => {
		const combatant = createCombatantFixture({ actor: null });
		expect(isCombatantDying(combatant)).toBe(false);
	});
});

describe('getCombatantResetActions', () => {
	it('resets to the base max when not dying', () => {
		const combatant = createCombatantFixture({
			actionsMax: 3,
			actor: createCombatActorFixture({ type: 'character' }),
		});
		expect(getCombatantResetActions(combatant)).toBe(3);
	});

	it('resets to 1 when dying', () => {
		const combatant = createCombatantFixture({ actionsMax: 3, actor: createDyingActor() });
		expect(getCombatantResetActions(combatant)).toBe(1);
	});
});

describe('getCombatantEffectiveMax', () => {
	it('caps the effective max at 1 when dying, ignoring additional actions', () => {
		const combatant = createCombatantFixture({ actionsMax: 3, actor: createDyingActor() });
		// Simulate a stale additional action that should not raise the dying cap.
		(
			combatant.system as unknown as { actions: { base: { additional: number } } }
		).actions.base.additional = 2;
		expect(getCombatantEffectiveMax(combatant)).toBe(1);
	});

	it('includes additional actions when not dying', () => {
		const combatant = createCombatantFixture({
			actionsMax: 3,
			actor: createCombatActorFixture({ type: 'character' }),
		});
		(
			combatant.system as unknown as { actions: { base: { additional: number } } }
		).actions.base.additional = 2;
		expect(getCombatantEffectiveMax(combatant)).toBe(5);
	});
});
