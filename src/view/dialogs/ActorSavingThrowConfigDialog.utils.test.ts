import { describe, expect, it } from 'vitest';

import {
	calculateDefaultRollModes,
	collectSituationalRules,
} from './ActorSavingThrowConfigDialog.utils.js';

const SAVING_THROW_KEYS = ['strength', 'dexterity', 'intelligence', 'will'];

const WARRIOR_SAVES = { advantage: 'strength', disadvantage: 'dexterity' };

interface StubRule {
	type: string;
	disabled?: boolean;
	priority?: number;
	label?: string;
	target?: string;
	mode?: string;
	value?: number;
	selectedSave?: string;
	requiresChoice?: boolean;
	situation?: string;
}

/** Stands in for an embedded item: the calculators read the `rules` Map, not `system.rules`. */
function createItem(name: string, rules: StubRule[]) {
	return { name, rules: new Map(rules.map((rule, index) => [String(index), rule])) };
}

describe('calculateDefaultRollModes', () => {
	it('starts every save at the class defaults', () => {
		const rollModes = calculateDefaultRollModes([], WARRIOR_SAVES, SAVING_THROW_KEYS);

		expect(rollModes).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('ignores a situational rule so the stored default stays at the class value', () => {
		// Survivalist's "advantage against poison saves" only applies when poison comes up.
		// Folding it in would hand out blanket advantage on every save.
		const items = [
			createItem('Survivalist', [
				{ type: 'savingThrowRollMode', value: 1, mode: 'adjust', situation: 'poison' },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('still applies an otherwise identical rule that names no situation', () => {
		// The guard must key on `situation` alone — this is the same rule without it.
		const items = [
			createItem('Homebrew', [{ type: 'savingThrowRollMode', value: 1, mode: 'adjust' }]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 2,
			dexterity: 0,
			intelligence: 1,
			will: 1,
		});
	});

	it('neutralizes the class disadvantage with a set rule targeting disadvantaged', () => {
		const items = [
			createItem('Celestial', [
				{ type: 'savingThrowRollMode', value: 0, mode: 'set', target: 'disadvantaged' },
			]),
		];

		const rollModes = calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS);

		expect(rollModes.dexterity).toBe(0);
		expect(rollModes.strength).toBe(1);
	});

	it('applies a choice-based rule only once a save has been picked', () => {
		const unpicked = [
			createItem('Flameborn', [
				{
					type: 'savingThrowRollMode',
					value: 1,
					mode: 'set',
					target: 'neutral',
					requiresChoice: true,
				},
			]),
		];
		expect(calculateDefaultRollModes(unpicked, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(0);

		const picked = [
			createItem('Flameborn', [
				{
					type: 'savingThrowRollMode',
					value: 1,
					mode: 'set',
					target: 'neutral',
					requiresChoice: true,
					selectedSave: 'will',
				},
			]),
		];
		expect(calculateDefaultRollModes(picked, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(1);
	});

	it('skips disabled rules', () => {
		const items = [
			createItem('Disabled', [
				{ type: 'savingThrowRollMode', value: 1, mode: 'adjust', target: 'all', disabled: true },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS).intelligence).toBe(0);
	});

	it('clamps an adjust rule to the -3..3 range', () => {
		const stacked = [
			createItem('Stacked', [
				{ type: 'savingThrowRollMode', value: 9, mode: 'adjust', target: 'will' },
			]),
		];
		expect(calculateDefaultRollModes(stacked, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(3);

		const sapped = [
			createItem('Sapped', [
				{ type: 'savingThrowRollMode', value: -9, mode: 'adjust', target: 'will' },
			]),
		];
		expect(calculateDefaultRollModes(sapped, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(-3);
	});

	it('targets the saves that are currently advantaged', () => {
		const items = [
			createItem('Focused', [
				{ type: 'savingThrowRollMode', value: 1, mode: 'adjust', target: 'advantaged' },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 2,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('targets only the saves left neutral by the class', () => {
		const items = [
			createItem('Steady', [
				{ type: 'savingThrowRollMode', value: 1, mode: 'adjust', target: 'neutral' },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 1,
			will: 1,
		});
	});

	it('applies an unrecognised target to nothing', () => {
		const items = [
			createItem('Homebrew', [
				{ type: 'savingThrowRollMode', value: 3, mode: 'set', target: 'sideways' },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('treats an absent mode as set, matching the schema default', () => {
		// `resolveSavingThrowRollModes` branches the same way, so both entry points agree.
		const items = [
			createItem('Origin', [{ type: 'savingThrowRollMode', value: 2, target: 'strength' }]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS).strength).toBe(2);
	});

	it('ignores rules of other types and items carrying none', () => {
		const items = [
			createItem('Survivalist', [{ type: 'maxHitDice', target: 'all' }]),
			{ name: 'Bare' },
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('handles a class that sets only an advantaged save', () => {
		expect(calculateDefaultRollModes([], { advantage: 'will' }, SAVING_THROW_KEYS)).toEqual({
			strength: 0,
			dexterity: 0,
			intelligence: 0,
			will: 1,
		});
	});

	it('handles a class that sets only a disadvantaged save', () => {
		expect(calculateDefaultRollModes([], { disadvantage: 'will' }, SAVING_THROW_KEYS)).toEqual({
			strength: 0,
			dexterity: 0,
			intelligence: 0,
			will: -1,
		});
	});

	it('treats an absent value as no change', () => {
		const items = [
			createItem('Empty', [{ type: 'savingThrowRollMode', mode: 'adjust', target: 'will' }]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(0);
	});

	it('falls back to the target when selectedSave is not a known save', () => {
		const items = [
			createItem('Homebrew', [
				{
					type: 'savingThrowRollMode',
					value: 2,
					mode: 'set',
					target: 'will',
					selectedSave: 'charisma',
				},
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(2);
	});

	it('applies rules in priority order', () => {
		// The `set` runs first (priority 1) and the later `adjust` stacks on top of it, so the
		// adjustment survives — reverse the sort and this collapses to 0.
		const items = [
			createItem('Origin', [
				{ type: 'savingThrowRollMode', value: 2, mode: 'adjust', target: 'will', priority: 2 },
				{ type: 'savingThrowRollMode', value: 0, mode: 'set', target: 'will', priority: 1 },
			]),
		];

		expect(calculateDefaultRollModes(items, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(2);
	});
});

describe('collectSituationalRules', () => {
	it('returns only rules that name a situation', () => {
		const items = [
			createItem('Survivalist', [
				{ type: 'savingThrowRollMode', label: 'Survivalist', value: 1, situation: 'poison' },
				{ type: 'savingThrowRollMode', value: 1, mode: 'adjust' },
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

	it('falls back to the item name when the rule carries no label', () => {
		const items = [
			createItem('Haunted Past', [{ type: 'savingThrowRollMode', value: 1, situation: 'fear' }]),
		];

		expect(collectSituationalRules(items)).toEqual([
			{ label: 'Haunted Past', situation: 'fear', value: 1 },
		]);
	});

	it('skips a zero-valued rule rather than listing a reminder that grants nothing', () => {
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
