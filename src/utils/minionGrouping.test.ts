import { describe, expect, it } from 'vitest';
import { createCombatActorFixture, createCombatantFixture } from '../../tests/fixtures/combat.js';
import { isMinionCombatant } from './minionGrouping.js';

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
