import { describe, expect, it } from 'vitest';

import { calculateDefaultRollModes } from './ActorSavingThrowConfigDialog.utils.js';

const SAVING_THROW_KEYS = ['strength', 'dexterity', 'intelligence', 'will'];

const WARRIOR_SAVES = { advantage: 'strength', disadvantage: 'dexterity' };

interface StubRule {
	type: string;
	priority?: number;
	target?: string;
	mode?: string;
	value?: number;
	checkType?: string;
	saves?: string[];
}

/** Stands in for an embedded item: the calculator reads the `rules` Map, not `system.rules`. */
function createItem(name: string, rules: StubRule[]) {
	return { name, rules: new Map(rules.map((rule, index) => [String(index), rule])) };
}

describe('calculateDefaultRollModes', () => {
	it('starts every save at the class defaults when no item carries a rule', () => {
		expect(calculateDefaultRollModes([], WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('folds the rules of every item together in priority order', () => {
		const items = [
			createItem('Origin', [
				{ type: 'savingThrowRollMode', value: 2, mode: 'adjust', target: 'will', priority: 2 },
			]),
			createItem('Celestial', [
				{ type: 'savingThrowRollMode', value: 0, mode: 'set', target: 'will', priority: 1 },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(2);
	});

	it('ignores rules of other types', () => {
		const items = [createItem('Survivalist', [{ type: 'maxHitDice', target: 'all' }])];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	// Survivalist's "advantage against poison saves" is a `situationalRollMode`, which the
	// roller opts into per roll. Folding it in would hand out blanket advantage on every STR
	// save, whether or not poison is involved.
	it('ignores a situationalRollMode rule so the stored default stays at the class value', () => {
		const items = [
			createItem('Survivalist', [
				{ type: 'situationalRollMode', value: 1, checkType: 'savingThrow', saves: ['strength'] },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});
});
