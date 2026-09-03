import { describe, expect, it } from 'vitest';

import calculateSavingThrowRollModes, {
	type SavingThrowRollModeRuleData,
} from './calculateSavingThrowRollModes.js';

const SAVING_THROW_KEYS = ['strength', 'dexterity', 'intelligence', 'will'];

const WARRIOR_SAVES = { advantage: 'strength', disadvantage: 'dexterity' };

function rollModeRule(rule: Partial<SavingThrowRollModeRuleData>): SavingThrowRollModeRuleData {
	return { type: 'savingThrowRollMode', ...rule };
}

describe('calculateSavingThrowRollModes', () => {
	it('starts every save at the class defaults', () => {
		expect(calculateSavingThrowRollModes([], WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('handles a class that sets only an advantaged save', () => {
		expect(calculateSavingThrowRollModes([], { advantage: 'will' }, SAVING_THROW_KEYS)).toEqual({
			strength: 0,
			dexterity: 0,
			intelligence: 0,
			will: 1,
		});
	});

	it('handles a class that sets only a disadvantaged save', () => {
		expect(calculateSavingThrowRollModes([], { disadvantage: 'will' }, SAVING_THROW_KEYS)).toEqual({
			strength: 0,
			dexterity: 0,
			intelligence: 0,
			will: -1,
		});
	});

	it('applies an untargeted adjust rule to every save', () => {
		const rules = [rollModeRule({ value: 1, mode: 'adjust' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 2,
			dexterity: 0,
			intelligence: 1,
			will: 1,
		});
	});

	it('neutralizes the class disadvantage with a set rule targeting disadvantaged', () => {
		const rules = [rollModeRule({ value: 0, mode: 'set', target: 'disadvantaged' })];

		const rollModes = calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS);

		expect(rollModes.dexterity).toBe(0);
		expect(rollModes.strength).toBe(1);
	});

	it('targets the saves that are currently advantaged', () => {
		const rules = [rollModeRule({ value: 1, mode: 'adjust', target: 'advantaged' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 2,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('targets only the saves left neutral by the class', () => {
		const rules = [rollModeRule({ value: 1, mode: 'adjust', target: 'neutral' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 1,
			will: 1,
		});
	});

	it('applies an unrecognised target to nothing', () => {
		const rules = [rollModeRule({ value: 3, mode: 'set', target: 'sideways' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 1,
			dexterity: -1,
			intelligence: 0,
			will: 0,
		});
	});

	it('applies a choice-based rule only once a save has been picked', () => {
		const unpicked = [
			rollModeRule({ value: 1, mode: 'set', target: 'neutral', requiresChoice: true }),
		];
		expect(calculateSavingThrowRollModes(unpicked, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(0);

		const picked = [
			rollModeRule({
				value: 1,
				mode: 'set',
				target: 'neutral',
				requiresChoice: true,
				selectedSave: 'will',
			}),
		];
		expect(calculateSavingThrowRollModes(picked, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(1);
	});

	it('falls back to the target when selectedSave is not a known save', () => {
		const rules = [
			rollModeRule({ value: 2, mode: 'set', target: 'will', selectedSave: 'charisma' }),
		];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(2);
	});

	it('skips disabled rules', () => {
		const rules = [rollModeRule({ value: 1, mode: 'adjust', target: 'all', disabled: true })];

		expect(
			calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS).intelligence,
		).toBe(0);
	});

	it('clamps an adjust rule to the -3..3 range', () => {
		const stacked = [rollModeRule({ value: 9, mode: 'adjust', target: 'will' })];
		expect(calculateSavingThrowRollModes(stacked, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(3);

		const sapped = [rollModeRule({ value: -9, mode: 'adjust', target: 'will' })];
		expect(calculateSavingThrowRollModes(sapped, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(-3);
	});

	it('treats an absent mode as set, matching the schema default', () => {
		const rules = [rollModeRule({ value: 2, target: 'strength' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS).strength).toBe(2);
	});

	it('treats an absent target as all, matching the schema default', () => {
		const rules = [rollModeRule({ value: 2, mode: 'set' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS)).toEqual({
			strength: 2,
			dexterity: 2,
			intelligence: 2,
			will: 2,
		});
	});

	it('treats an absent value as no change', () => {
		const rules = [rollModeRule({ mode: 'adjust', target: 'will' })];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(0);
	});

	it('applies rules in priority order', () => {
		// The `set` runs first (priority 1) and the later `adjust` stacks on top of it, so the
		// adjustment survives. Reverse the sort and this collapses to 0.
		const rules = [
			rollModeRule({ value: 2, mode: 'adjust', target: 'will', priority: 2 }),
			rollModeRule({ value: 0, mode: 'set', target: 'will', priority: 1 }),
		];

		expect(calculateSavingThrowRollModes(rules, WARRIOR_SAVES, SAVING_THROW_KEYS).will).toBe(2);
	});
});
