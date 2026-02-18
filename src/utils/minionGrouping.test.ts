import { describe, expect, it } from 'vitest';
import { createCombatActorFixture, createCombatantFixture } from '../../tests/fixtures/combat.js';
import {
	getMinionGroupIdentityColorByLabel,
	getMinionGroupIdentityColorByLabelIndex,
	isMinionCombatant,
} from './minionGrouping.js';

describe('isMinionCombatant', () => {
	it('returns true when actor type is minion', () => {
		const combatant = createCombatantFixture({
			type: 'npc',
			actor: {
				...createCombatActorFixture({ id: 'actor-minion' }),
				type: 'minion',
			} as unknown as Actor.Implementation,
		});

		expect(isMinionCombatant(combatant)).toBe(true);
	});

	it('returns true when combatant type is minion and actor type is missing', () => {
		const combatant = createCombatantFixture({
			type: 'minion',
			actor: createCombatActorFixture({ id: 'actor-unknown' }),
		});
		delete (combatant.actor as unknown as { type?: string }).type;

		expect(isMinionCombatant(combatant)).toBe(true);
	});

	it('returns false for non-minions', () => {
		const combatant = createCombatantFixture({
			type: 'npc',
			actor: {
				...createCombatActorFixture({ id: 'actor-npc' }),
				type: 'npc',
			} as unknown as Actor.Implementation,
		});

		expect(isMinionCombatant(combatant)).toBe(false);
	});
});

describe('getMinionGroupIdentityColorByLabelIndex', () => {
	it('returns configured colors for the first six group letters', () => {
		expect(getMinionGroupIdentityColorByLabelIndex(0)).toBe('#3B82F6');
		expect(getMinionGroupIdentityColorByLabelIndex(1)).toBe('#F97316');
		expect(getMinionGroupIdentityColorByLabelIndex(2)).toBe('#8B5CF6');
		expect(getMinionGroupIdentityColorByLabelIndex(3)).toBe('#FACC15');
		expect(getMinionGroupIdentityColorByLabelIndex(4)).toBe('#06B6D4');
		expect(getMinionGroupIdentityColorByLabelIndex(5)).toBe('#D946EF');
	});

	it('repeats the 6-color cycle for later groups', () => {
		expect(getMinionGroupIdentityColorByLabelIndex(6)).toBe('#3B82F6');
		expect(getMinionGroupIdentityColorByLabelIndex(7)).toBe('#F97316');
	});
});

describe('getMinionGroupIdentityColorByLabel', () => {
	it('maps label letters to the same palette by label index', () => {
		expect(getMinionGroupIdentityColorByLabel('A')).toBe('#3B82F6');
		expect(getMinionGroupIdentityColorByLabel('B')).toBe('#F97316');
		expect(getMinionGroupIdentityColorByLabel('C')).toBe('#8B5CF6');
		expect(getMinionGroupIdentityColorByLabel('D')).toBe('#FACC15');
		expect(getMinionGroupIdentityColorByLabel('E')).toBe('#06B6D4');
		expect(getMinionGroupIdentityColorByLabel('F')).toBe('#D946EF');
		expect(getMinionGroupIdentityColorByLabel('G')).toBe('#3B82F6');
	});
});
