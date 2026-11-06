import { describe, expect, it } from 'vitest';
import { itemLike } from '../documentLikes.ts';

function itemWith(rules: Record<string, unknown>[]) {
	return {
		id: 'boots',
		uuid: 'Item.boots',
		name: 'Boots',
		img: '',
		type: 'object',
		system: {},
		rules: new Map(rules.map((rule) => [String(rule.id), rule])),
	} as unknown as Item;
}

describe('itemLike', () => {
	it('gives the amount the rule applied, and works out none of its own', () => {
		const item = itemWith([
			{
				id: 'applied',
				type: 'speedBonus',
				appliedAmount: 3,
				appliesTo: () => true,
				toObject: () => ({ value: '@level' }),
			},
			{ id: 'none', type: 'speedBonus', appliesTo: () => false, toObject: () => ({ value: '2' }) },
		]);

		const [applied, none] = itemLike(item).rules;

		expect(applied).toMatchObject({ id: 'applied', active: true, amount: 3 });
		expect(none).toMatchObject({ id: 'none', active: false, amount: undefined });
	});
});
