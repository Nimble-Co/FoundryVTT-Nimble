import { describe, expect, it } from 'vitest';
import { taggedCreature as creature } from '../../../../tests/fixtures/conditionCreature.js';
import { attackConditionLines, conditionDelivery } from '../attackConditionLines.js';

const untypedAttack = {
	targets: { attackType: '' },
	effects: [{ type: 'damage', canCrit: true, canMiss: true }],
};

const proneLines = (roller: ReturnType<typeof creature>) =>
	attackConditionLines(roller, untypedAttack, creature('Kael', ['prone'])).map(
		(line) => `${line.step}:${line.on}`,
	);

describe('attackConditionLines', () => {
	it('gives a monster attack with no attack type the melee Prone step', () => {
		expect(proneLines(creature('Goblin', [], { type: 'npc' }))).toEqual(['1:true']);
	});

	it('lets the roller pick for a hero attack with no attack type', () => {
		expect(proneLines(creature('Ayla', [], { type: 'character' }))).toEqual([
			'1:false',
			'-1:false',
		]);
	});
});

describe('conditionDelivery', () => {
	it('reads a spell Range or Reach property before the hero default', () => {
		const hero = { type: 'character' };
		expect(conditionDelivery(untypedAttack, ['range'], hero)).toBe('ranged');
		expect(conditionDelivery(untypedAttack, ['reach'], hero)).toBe('melee');
		expect(conditionDelivery(untypedAttack, ['range', 'reach'], hero)).toBeNull();
	});

	it('makes a monster attack with no attack type melee', () => {
		expect(conditionDelivery(untypedAttack, [], { type: 'minion' })).toBe('melee');
		expect(conditionDelivery({ targets: { attackType: 'range' } }, [], { type: 'minion' })).toBe(
			'ranged',
		);
	});
});
