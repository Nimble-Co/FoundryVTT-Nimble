import { describe, expect, it } from 'vitest';
import { createDiceDivisionState } from '../diceDivisionState.svelte.ts';

const division = {
	source: 'Grim Harrow',
	dice: 3,
	targets: [
		{ uuid: 'Token.goblin', name: 'Goblin' },
		{ uuid: 'Token.kobold', name: 'Kobold' },
	],
};

describe('the dice division of the roll window', () => {
	it('starts with the dice spread evenly, the first target taking what is left over', () => {
		const state = createDiceDivisionState(division);

		expect(state.rows.map((row) => [row.name, row.dice])).toEqual([
			['Goblin', 2],
			['Kobold', 1],
		]);
		expect(state.heading).toBe('Divide the dice (Grim Harrow)');
		expect(state.totalLine).toBe('3/3 dice set');
		expect(state.cannotRollReason).toBe('');
	});

	it('cannot give out more dice than there are', () => {
		const state = createDiceDivisionState(division);

		state.adjust('Token.kobold', 1);

		expect(state.rows[1]?.dice).toBe(1);
		expect(state.rows[1]?.limit).toBe(1);
	});

	it('cannot roll until every die is given out', () => {
		const state = createDiceDivisionState(division);

		state.adjust('Token.goblin', -2);

		expect(state.totalLine).toBe('1/3 dice set');
		expect(state.cannotRollReason).toBe('Give out every die before you roll.');
		expect(state.rows[0]?.limit).toBe(2);
	});

	it('sends the dice of each target, in the order of the targets', () => {
		const state = createDiceDivisionState(division);
		state.adjust('Token.goblin', -2);
		state.set('Token.kobold', 3);

		expect(state.shares).toEqual([
			{ targetUuid: 'Token.goblin', dice: 0 },
			{ targetUuid: 'Token.kobold', dice: 3 },
		]);
	});

	it('clamps a typed amount to the dice left', () => {
		const state = createDiceDivisionState(division);

		expect(state.set('Token.kobold', 9)).toBe(1);
		expect(state.set('Token.kobold', -2)).toBe(0);
	});

	it('is empty without a division', () => {
		const state = createDiceDivisionState(undefined);

		expect(state.rows).toEqual([]);
		expect(state.cannotRollReason).toBe('');
		expect(state.shares).toBeUndefined();
	});
});
