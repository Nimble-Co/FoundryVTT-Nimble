import { describe, expect, it } from 'vitest';
import { heroItem } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { byName, spellsBySchool, spellsByTier } from '../rowOrder.ts';
import type { ItemLike } from '../sheetSource.ts';

const spell = (name: string, tier: number, school: string, utility = false): ItemLike =>
	heroItem({
		id: name,
		type: 'spell',
		name,
		system: { tier, school, properties: { selected: utility ? ['utilitySpell'] : [] } },
	});

const names = (items: { name: string }[]) => items.map((item) => item.name);

describe('byName', () => {
	it('orders A to Z, with no regard to case', () => {
		expect(names(byName([{ name: 'rope' }, { name: 'Axe' }, { name: 'bow' }]))).toEqual([
			'Axe',
			'bow',
			'rope',
		]);
	});
});

describe('spellsByTier', () => {
	it('groups the tiers from low to high, A to Z in each tier', () => {
		const groups = spellsByTier([
			spell('Zap', 1, 'lightning'),
			spell('Ember', 0, 'fire'),
			spell('Blizzard', 2, 'ice'),
			spell('Arc', 1, 'lightning'),
			spell('Breeze', 0, 'wind'),
		]);

		expect(groups.map((group) => group.tier)).toEqual([0, 1, 2]);
		expect(groups.map((group) => names(group.spells))).toEqual([
			['Breeze', 'Ember'],
			['Arc', 'Zap'],
			['Blizzard'],
		]);
	});

	it('puts a utility spell in tier 0, with the cantrips', () => {
		const groups = spellsByTier([spell('Light', 2, 'radiant', true), spell('Ember', 0, 'fire')]);

		expect(groups).toEqual([{ tier: 0, spells: [expect.anything(), expect.anything()] }]);
		expect(names(groups[0].spells)).toEqual(['Ember', 'Light']);
	});
});

describe('spellsBySchool', () => {
	it('groups the schools A to Z, with cantrips first, then each tier, then A to Z', () => {
		const groups = spellsBySchool([
			spell('Inferno', 3, 'fire'),
			spell('Frost', 0, 'ice'),
			spell('Fireball', 1, 'fire'),
			spell('Ember', 0, 'fire'),
			spell('Blaze', 1, 'fire'),
		]);

		expect(groups.map((group) => group.school)).toEqual(['fire', 'ice']);
		expect(names(groups[0].spells)).toEqual(['Ember', 'Blaze', 'Fireball', 'Inferno']);
	});

	it('puts the utility spells of a school after its tiers', () => {
		const groups = spellsBySchool([
			spell('Light', 1, 'radiant', true),
			spell('Smite', 2, 'radiant'),
		]);

		expect(names(groups[0].spells)).toEqual(['Smite', 'Light']);
	});
});
