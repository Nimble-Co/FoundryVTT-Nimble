import { describe, expect, it } from 'vitest';
import { createCombatActorFixture } from '../../tests/fixtures/combat.js';
import { getActorHealthState, isActorAtOrBelowHalfHp } from './actorHealthState.js';

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

	it('returns unknown for non-solo actors at 0 HP', () => {
		const actor = createCombatActorFixture({
			type: 'npc',
			hp: 0,
			hpMax: 10,
		});

		expect(getActorHealthState(actor)).toBe('unknown');
	});

	it('returns lastStand for solo monsters with the lastStand status and positive HP', () => {
		const actor = Object.assign(
			createCombatActorFixture({
				type: 'soloMonster',
				hp: 180,
				hpMax: 320,
				lastStandHp: 180,
			}),
			{ statuses: new Set(['lastStand']) },
		);

		expect(getActorHealthState(actor as Actor.Implementation)).toBe('lastStand');
	});

	it('returns lastStand priority over bloodied when both are true', () => {
		// Last Stand status set + HP below half — should still report 'lastStand'.
		const actor = Object.assign(
			createCombatActorFixture({
				type: 'soloMonster',
				hp: 50,
				hpMax: 320,
				lastStandHp: 180,
			}),
			{ statuses: new Set(['lastStand']) },
		);

		expect(getActorHealthState(actor as Actor.Implementation)).toBe('lastStand');
	});

	it('returns bloodied for solo monsters at low HP without the lastStand status', () => {
		const actor = createCombatActorFixture({
			type: 'soloMonster',
			hp: 100,
			hpMax: 320,
			lastStandHp: 180,
		});

		expect(getActorHealthState(actor)).toBe('bloodied');
	});

	it('returns unknown for solo monsters at 0 HP — even with lastStandHp configured (about to enter)', () => {
		const actor = createCombatActorFixture({
			type: 'soloMonster',
			hp: 0,
			hpMax: 320,
			lastStandHp: 180,
		});

		expect(getActorHealthState(actor)).toBe('unknown');
	});

	it('returns unknown when in Last Stand but HP has dropped to 0 (died in Last Stand)', () => {
		const actor = Object.assign(
			createCombatActorFixture({
				type: 'soloMonster',
				hp: 0,
				hpMax: 320,
				lastStandHp: 180,
			}),
			{ statuses: new Set(['lastStand']) },
		);

		expect(getActorHealthState(actor as Actor.Implementation)).toBe('unknown');
	});
});

describe('isActorAtOrBelowHalfHp', () => {
	it('returns true at exactly half HP', () => {
		const actor = createCombatActorFixture({ type: 'npc', hp: 5, hpMax: 10 });
		expect(isActorAtOrBelowHalfHp(actor)).toBe(true);
	});

	it('returns false above half HP', () => {
		const actor = createCombatActorFixture({ type: 'npc', hp: 6, hpMax: 10 });
		expect(isActorAtOrBelowHalfHp(actor)).toBe(false);
	});

	it('returns false at 0 HP (dying, not bloodied)', () => {
		const actor = createCombatActorFixture({ type: 'npc', hp: 0, hpMax: 10 });
		expect(isActorAtOrBelowHalfHp(actor)).toBe(false);
	});

	it('is independent of the lastStand status', () => {
		const actor = Object.assign(
			createCombatActorFixture({ type: 'soloMonster', hp: 50, hpMax: 320, lastStandHp: 180 }),
			{ statuses: new Set(['lastStand']) },
		);
		expect(isActorAtOrBelowHalfHp(actor as Actor.Implementation)).toBe(true);
	});
});
