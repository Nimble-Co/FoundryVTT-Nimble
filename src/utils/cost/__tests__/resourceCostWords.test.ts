import { describe, expect, it } from 'vitest';
import type { ResourceCost } from '#types/resourceCost.d.ts';
import { cardCostsOf } from '../resourceCostWords.js';

function taken(kind: ResourceCost['kind'], amount: number, source: string): ResourceCost {
	return { kind, amount, spend: { mode: 'fixed' }, beyond: 'notAllowed', source };
}

describe('cardCostsOf', () => {
	it('leaves out a cost that took nothing, so the card has no "Cost: 0" line', () => {
		expect(cardCostsOf([taken('mana', 0, 'Surge'), taken('hp', 5, 'Blood Price')])).toEqual([
			{ kind: 'hp', amount: 5, source: 'Blood Price' },
		]);
	});

	it('keeps the roll of a rolled cost', () => {
		expect(cardCostsOf([{ ...taken('wounds', 3, 'Pact'), roll: '1d4' }])).toEqual([
			{ kind: 'wounds', amount: 3, source: 'Pact', roll: '1d4' },
		]);
	});
});
