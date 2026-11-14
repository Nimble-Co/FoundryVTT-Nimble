import { describe, expect, it } from 'vitest';
import { readItem, rulesOfType } from '../../../../tests/fixtures/packContent.js';

const FILE = 'packs/boons/core/major/unflinching.json';

describe('Unflinching', () => {
	it('gives advantage on the Strength save that keeps Concentration, and on no other save', () => {
		const item = readItem(FILE);
		const rules = rulesOfType(item.system.rules, 'situationalRollMode');

		expect(rules).toEqual([
			expect.objectContaining({
				value: 1,
				checkType: 'savingThrow',
				saves: ['strength'],
				predicate: { $and: ['save:keep:concentration'] },
			}),
		]);
		expect(String(rules[0].id)).toMatch(/^[A-Za-z0-9]{16}$/);
	});
});
