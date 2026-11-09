import { taggedCreature } from '../../../../tests/fixtures/conditionCreature.js';
import { NimbleBaseActor } from '../base.svelte.js';

function poisoned(type: 'character' | 'npc') {
	return Object.assign(
		Object.create(NimbleBaseActor.prototype),
		taggedCreature('Kael', ['poisoned']),
		{
			type,
			isType: (candidate: string) => candidate === type,
		},
	) as NimbleBaseActor;
}

const conditions = (lines: Array<{ condition: string }>) => lines.map((line) => line.condition);

describe('NimbleBaseActor#checkConditionLines', () => {
	it('gives a character the conditions on initiative', () => {
		expect(conditions(poisoned('character').checkConditionLines('initiative'))).toEqual([
			'poisoned',
		]);
	});

	it('gives no condition to the initiative of a creature that is not a character', () => {
		const monster = poisoned('npc');

		expect(monster.checkConditionLines('initiative')).toEqual([]);
		expect(conditions(monster.checkConditionLines('savingThrow'))).toEqual(['poisoned']);
	});
});
