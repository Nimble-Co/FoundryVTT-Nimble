import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectLike, itemLike } from '../documentLikes.ts';

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

describe('effectLike', () => {
	beforeEach(() => {
		vi.stubGlobal('fromUuidSync', () => null);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const effectOn = (parent: { documentName: string; id: string }, origin: string | null) =>
		({
			id: 'shield',
			name: 'Shield',
			img: '',
			statuses: new Set(),
			origin,
			parent,
			duration: {},
			getFlag: () => undefined,
			system: {},
			_source: {},
		}) as never;

	it('makes an effect on the actor temporary, also when its origin is an item of that actor', () => {
		const applied = effectLike(
			effectOn({ documentName: 'Actor', id: 'hero' }, 'Actor.hero.Item.frost'),
		);

		expect(applied.temporary).toBe(true);
		expect(applied.itemId).toBeNull();
	});

	it('gives the stacks of an effect with Stacks on, and none for one with Stacks off', () => {
		const stacked = (on: boolean) =>
			Object.assign(effectOn({ documentName: 'Actor', id: 'hero' }, null), {
				system: { stacks: { on, count: 3 } },
			});

		expect(effectLike(stacked(true)).stacks).toBe(3);
		expect(effectLike(stacked(false)).stacks).toBeUndefined();
	});

	it('keeps an effect on an item, with no duration, passive', () => {
		const kept = effectLike(effectOn({ documentName: 'Item', id: 'frost' }, null));

		expect(kept.temporary).toBe(false);
		expect(kept.itemId).toBe('frost');
	});
});
