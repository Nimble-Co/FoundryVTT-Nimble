import { describe, expect, it } from 'vitest';
import { defendLinesOf, defendsOf } from '../defendRecords.js';

const SAND = { itemUuid: 'Item.sand', effectId: 'e-sand', name: 'Pocket Sand' };

function recordWith(fields: Record<string, unknown>) {
	const [record] = defendsOf({
		defends: [{ id: 'd1', tokenUuid: 'Scene.s.Token.pip', actorUuid: 'Actor.pip', ...fields }],
	});
	if (!record) throw new Error('no record');
	return record;
}

describe('defendsOf', () => {
	it('keeps the attacker effects of a Defend', () => {
		expect(recordWith({ attackerEffects: [SAND] }).attackerEffects).toEqual([SAND]);
	});

	it('drops an attacker effect with no item or effect id', () => {
		const record = recordWith({ attackerEffects: [{ name: 'Lost' }, SAND] });

		expect(record.attackerEffects).toEqual([SAND]);
	});

	it('has no attacker effects on a Defend that stored none', () => {
		expect(recordWith({}).attackerEffects).toEqual([]);
	});
});

describe('defendLinesOf', () => {
	it('shows the reminders, then a line with the name of each effect on the attacker', () => {
		const record = recordWith({ reminders: ['Decoy: move.'], attackerEffects: [SAND] });

		const lines = defendLinesOf(record);

		expect(lines[0]).toBe('Decoy: move.');
		expect(lines).toHaveLength(2);
		expect(lines[1]).toContain('Pocket Sand');
	});

	it('shows no line for an effect with no name', () => {
		const record = recordWith({ attackerEffects: [{ ...SAND, name: '' }] });

		expect(defendLinesOf(record)).toEqual([]);
	});
});
