import { describe, expect, it } from 'vitest';
import { createCombatActorFixture } from '../../tests/fixtures/combat.js';
import { getActorHealthState } from './actorHealthState.js';

describe('getActorHealthState', () => {
	it('returns bloodied for non-solo actors at half HP or lower', () => {
		const actor = createCombatActorFixture({
			type: 'npc',
			hp: 5,
			hpMax: 10,
		});

		expect(getActorHealthState(actor)).toBe('bloodied');
	});

	it('returns normal for non-solo actors above half HP', () => {
		const actor = createCombatActorFixture({
			type: 'character',
			hp: 6,
			hpMax: 10,
		});

		expect(getActorHealthState(actor)).toBe('normal');
	});

	it('returns lastStand for solo monsters at or below their threshold', () => {
		const actor = createCombatActorFixture({
			type: 'soloMonster',
			hp: 4,
			hpMax: 20,
			lastStandThreshold: 4,
		});

		expect(getActorHealthState(actor)).toBe('lastStand');
	});

	it('returns bloodied for solo monsters below half HP but above last stand threshold', () => {
		const actor = createCombatActorFixture({
			type: 'soloMonster',
			hp: 8,
			hpMax: 20,
			lastStandThreshold: 4,
		});

		expect(getActorHealthState(actor)).toBe('bloodied');
	});

	it('treats a zero or missing last stand threshold as disabled', () => {
		const actor = createCombatActorFixture({
			type: 'soloMonster',
			hp: 4,
			hpMax: 20,
			lastStandThreshold: 0,
		});

		expect(getActorHealthState(actor)).toBe('bloodied');
	});
});
