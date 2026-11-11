import { describe, expect, it } from 'vitest';
import { turnMoment } from '../turnMoment.js';

function combatantIn(round: number, turn: number, index: number) {
	const turns = [{ id: 'cA' }, { id: 'cB' }, { id: 'cC' }];
	const combat = { id: 'combat1', round, turn, turns };
	return { id: turns[index].id, name: 'Goblin', combat };
}

describe('turnMoment', () => {
	it('keys a turn by combat, round, combatant and boundary', () => {
		expect(turnMoment('turnStart', combatantIn(3, 1, 1), { round: 3, turn: 1 })).toEqual({
			round: 3,
			moment: {
				key: 'combat1:3:cB:turnStart',
				heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnStart', data: { name: 'Goblin' } },
			},
		});
	});

	it('a turn end with the place of the turn and one with no place have one key', () => {
		const ended = combatantIn(4, 0, 2);

		expect(turnMoment('turnEnd', ended, { round: 3, turn: 2 })?.moment.key).toBe(
			turnMoment('turnEnd', ended)?.moment.key,
		);
	});

	it('a combatant with more than one turn in the round adds the index of the turn', () => {
		const turns = [{ id: 'cHero' }, { id: 'cDragon' }, { id: 'cElf' }, { id: 'cDragon' }];
		const dragon = {
			id: 'cDragon',
			name: 'Dragon',
			combat: { id: 'combat1', round: 2, turn: 3, turns },
		};

		expect(turnMoment('turnEnd', dragon, { round: 2, turn: 1 })?.moment.key).toBe(
			'combat1:2:cDragon@1:turnEnd',
		);
		expect(turnMoment('turnEnd', dragon, { round: 2, turn: 3 })?.moment.key).toBe(
			'combat1:2:cDragon@3:turnEnd',
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
