import { describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../tests/fixtures/combat.js';
import { getCombatantResetActions, isCombatantDying } from './combatantSystem.js';

function createDyingActor(dyingActionLimit?: number) {
	return Object.assign(createCombatActorFixture({ type: 'character', dyingActionLimit }), {
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

	it('respects a raised dying action limit (e.g. Enduring Rage)', () => {
		const combatant = createCombatantFixture({ actionsMax: 3, actor: createDyingActor(2) });
		expect(getCombatantResetActions(combatant)).toBe(2);
	});

	it('never resets above the combatant base max even with a higher dying limit', () => {
		const combatant = createCombatantFixture({ actionsMax: 1, actor: createDyingActor(2) });
		expect(getCombatantResetActions(combatant)).toBe(1);
	});
});
