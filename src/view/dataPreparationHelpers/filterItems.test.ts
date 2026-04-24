import { describe, expect, it } from 'vitest';
import filterItems from './filterItems.js';

function makeActor(items: { name: string; type: string; system?: Record<string, unknown> }[]) {
	return {
		items: items.map((item) => ({
			...item,
			system: item.system ?? {},
		})),
	} as unknown as Parameters<typeof filterItems>[0];
}

describe('filterItems', () => {
	it('returns items matching the required types', () => {
		const actor = makeActor([
			{ name: 'Fireball', type: 'spell' },
			{ name: 'Shield', type: 'feature' },
		]);

		const result = filterItems(actor, ['feature'], '');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Shield');
	});

	it('accepts a single type string', () => {
		const actor = makeActor([
			{ name: 'Shield', type: 'feature' },
			{ name: 'Sword', type: 'object' },
		]);

		const result = filterItems(actor, 'feature', '');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Shield');
	});

	it('matches against item name (case-insensitive)', () => {
		const actor = makeActor([
			{ name: 'Second Wind', type: 'feature' },
			{ name: 'Steady Aim', type: 'feature' },
		]);

		const result = filterItems(actor, ['feature'], 'wind');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Second Wind');
	});

	it('matches against string description (feature/boon)', () => {
		const actor = makeActor([
			{
				name: 'Second Wind',
				type: 'feature',
				system: { description: '<p>Recover hit points during a <strong>field rest</strong>.</p>' },
			},
			{
				name: 'Steady Aim',
				type: 'feature',
				system: { description: '<p>Gain advantage on your next attack roll.</p>' },
			},
		]);

		const result = filterItems(actor, ['feature'], 'field rest');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Second Wind');
	});

	it('matches against object description fields (inventory)', () => {
		const actor = makeActor([
			{
				name: 'Healing Potion',
				type: 'object',
				system: {
					description: {
						public: '<p>Restores 2d4+2 hit points when consumed.</p>',
						unidentified: '<p>A bubbling red liquid.</p>',
						secret: '',
					},
				},
			},
			{
				name: 'Rope',
				type: 'object',
				system: {
					description: {
						public: '<p>50 feet of hempen rope.</p>',
						unidentified: '',
						secret: '',
					},
				},
			},
		]);

		const result = filterItems(actor, ['object'], 'hit points');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Healing Potion');
	});

	it('matches against spell description fields', () => {
		const actor = makeActor([
			{
				name: 'Arcane Bolt',
				type: 'spell',
				system: {
					description: {
						baseEffect: '<p>Deal 1d10 force damage to a target.</p>',
						higherLevelEffect: '',
						upcastEffect: '',
					},
				},
			},
		]);

		const result = filterItems(actor, ['spell'], 'force damage');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Arcane Bolt');
	});

	it('does not match against HTML tags', () => {
		const actor = makeActor([
			{
				name: 'Shield',
				type: 'feature',
				system: { description: '<p class="rest-block">Gain +2 AC.</p>' },
			},
		]);

		const result = filterItems(actor, ['feature'], 'rest-block');
		expect(result).toHaveLength(0);
	});

	it('prefers name match (returns item when name matches even if description does not)', () => {
		const actor = makeActor([
			{
				name: 'Field Rest Recovery',
				type: 'feature',
				system: { description: '<p>Some unrelated text.</p>' },
			},
		]);

		const result = filterItems(actor, ['feature'], 'field rest');
		expect(result).toHaveLength(1);
	});

	it('handles items with no description gracefully', () => {
		const actor = makeActor([{ name: 'Mystery', type: 'feature', system: {} }]);

		const result = filterItems(actor, ['feature'], 'anything');
		expect(result).toHaveLength(0);
	});

	it('handles null description gracefully', () => {
		const actor = makeActor([{ name: 'Mystery', type: 'feature', system: { description: null } }]);

		const result = filterItems(actor, ['feature'], 'anything');
		expect(result).toHaveLength(0);
	});

	it('returns all items of type when search term is empty', () => {
		const actor = makeActor([
			{ name: 'A', type: 'feature' },
			{ name: 'B', type: 'feature' },
			{ name: 'C', type: 'spell' },
		]);

		const result = filterItems(actor, ['feature'], '');
		expect(result).toHaveLength(2);
	});
});
