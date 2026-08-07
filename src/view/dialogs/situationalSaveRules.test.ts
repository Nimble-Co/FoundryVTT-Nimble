import { describe, expect, it } from 'vitest';

import { collectSituationalRules } from './situationalSaveRules.js';

interface StubRule {
	type: string;
	disabled?: boolean;
	label?: string;
	value?: number;
	situation?: string;
}

/** Stands in for an embedded item: the collector reads the `rules` Map, not `system.rules`. */
function createItem(name: string, rules: StubRule[]) {
	return { name, rules: new Map(rules.map((rule, index) => [String(index), rule])) };
}

describe('collectSituationalRules', () => {
	it('returns only rules that name a situation', () => {
		const items = [
			createItem('Survivalist', [
				{ type: 'savingThrowRollMode', label: 'Survivalist', value: 1, situation: 'poison' },
				{ type: 'savingThrowRollMode', value: 1 },
				{ type: 'maxHitDice', situation: 'poison' },
			]),
		];

		expect(collectSituationalRules(items)).toEqual([
			{ label: 'Survivalist', situation: 'poison', value: 1 },
		]);
	});

	it('skips disabled situational rules', () => {
		const items = [
			createItem('Survivalist', [
				{ type: 'savingThrowRollMode', value: 1, situation: 'poison', disabled: true },
			]),
		];

		expect(collectSituationalRules(items)).toEqual([]);
	});

	it('keeps a disadvantage reminder', () => {
		// The value is a roll mode level, so a negative one is a legitimate "disadvantage
		// against X" rule and must survive the zero-value filter.
		const items = [
			createItem('Cursed', [{ type: 'savingThrowRollMode', value: -1, situation: 'fear' }]),
		];

		expect(collectSituationalRules(items)).toEqual([
			{ label: 'Cursed', situation: 'fear', value: -1 },
		]);
	});

	it('falls back to the item name when the rule carries no label', () => {
		const items = [
			createItem('Haunted Past', [{ type: 'savingThrowRollMode', value: 1, situation: 'fear' }]),
		];

		expect(collectSituationalRules(items)).toEqual([
			{ label: 'Haunted Past', situation: 'fear', value: 1 },
		]);
	});

	it('skips a zero-valued rule rather than offering a toggle that grants nothing', () => {
		const items = [
			createItem('Survivalist', [{ type: 'savingThrowRollMode', value: 0, situation: 'poison' }]),
		];

		expect(collectSituationalRules(items)).toEqual([]);
	});

	it('handles an item carrying no rules', () => {
		expect(collectSituationalRules([{ name: 'Bare' }])).toEqual([]);
	});

	it('yields a blank label when neither the rule nor the item is named', () => {
		const items = [
			{ rules: new Map([['0', { type: 'savingThrowRollMode', value: 1, situation: 'fear' }]]) },
		];

		expect(collectSituationalRules(items)).toEqual([{ label: '', situation: 'fear', value: 1 }]);
	});
});
