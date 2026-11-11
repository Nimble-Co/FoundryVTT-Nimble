import { describe, expect, it } from 'vitest';
import { turnMoment } from '../turnMoment.js';

function combatantIn(round: number, turn: number, index: number) {
	const turns = [{ id: 'cA' }, { id: 'cB' }, { id: 'cC' }];
	const combat = { id: 'combat1', round, turn, turns };
	return { id: turns[index].id, name: 'Goblin', combat };
}

describe('turnMoment', () => {
	it('keys a turn by combat, round, index in the turn order and boundary', () => {
		expect(turnMoment('turnStart', combatantIn(3, 1, 1), { round: 3, turn: 1 })).toEqual({
			round: 3,
			moment: {
				key: 'combat1:3:1:turnStart',
				heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnStart', data: { name: 'Goblin' } },
			},
		});
	});

	it('with no index, keys the turn by the combatant', () => {
		expect(turnMoment('turnStart', combatantIn(3, 1, 1))?.moment.key).toBe(
			'combat1:3:cB:turnStart',
		);
	});

	it('a turn end after the round moved on is in the round before', () => {
		expect(turnMoment('turnEnd', combatantIn(4, 0, 2))?.round).toBe(3);
		expect(turnMoment('turnEnd', combatantIn(4, 2, 1))?.round).toBe(4);
	});

	it('outside a combat there is no turn moment', () => {
		expect(turnMoment('turnStart', { id: 'cA', name: 'Goblin', combat: null })).toBeNull();
		expect(turnMoment('turnStart', null)).toBeNull();
	});
});
