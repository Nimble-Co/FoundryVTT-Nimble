import { describe, expect, it } from 'vitest';
import { createCombatActorFixture, createCombatantFixture } from '../../tests/fixtures/combat.js';
import {
	getEffectiveMinionGroupLeader,
	getMinionGroupSummaries,
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

	it('does not use initiative to choose a minion group leader when manual sort ties', () => {
		const alphaLeader = createCombatantFixture({
			id: 'alpha-leader',
			type: 'npc',
			sort: 0,
			initiative: 5,
			flags: {
				nimble: {
					minionGroup: {
						id: 'group-1',
						role: 'leader',
					},
				},
			},
			actor: {
				...createCombatActorFixture({ id: 'actor-alpha-leader' }),
				type: 'minion',
			} as unknown as Actor.Implementation,
		});
		(alphaLeader as unknown as { name: string }).name = 'Alpha';
		const betaMember = createCombatantFixture({
			id: 'beta-member',
			type: 'npc',
			sort: 0,
			initiative: 20,
			flags: {
				nimble: {
					minionGroup: {
						id: 'group-1',
						role: 'member',
					},
				},
			},
			actor: {
				...createCombatActorFixture({ id: 'actor-beta-member' }),
				type: 'minion',
			} as unknown as Actor.Implementation,
		});
		(betaMember as unknown as { name: string }).name = 'Beta';

		const summary = getMinionGroupSummaries([alphaLeader, betaMember]).get('group-1');
		if (!summary) throw new Error('Expected minion group summary');

		expect(summary.members.map((combatant) => combatant.id)).toEqual([
			'alpha-leader',
			'beta-member',
		]);
		expect(getEffectiveMinionGroupLeader(summary)?.id).toBe('alpha-leader');
	});
});
