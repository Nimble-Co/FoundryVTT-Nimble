import { describe, expect, it } from 'vitest';
import {
	moveLabelledModifier,
	statsInFormula,
	statsOfRoll,
	swapStatInFormula,
} from '../rollStat.js';

describe('statsInFormula', () => {
	it('finds the stats a weapon formula names', () => {
		expect(statsInFormula('1d10+@strength')).toEqual(['strength']);
		expect(statsInFormula('6+ min(@dexterity,2)-@dexterity')).toEqual(['dexterity']);
		expect(statsInFormula('1d6+max(@strength,@will)')).toEqual(['strength', 'will']);
	});

	it('finds none in a number, in @key, or in a longer key', () => {
		expect(statsInFormula('1d6+3')).toEqual([]);
		expect(statsInFormula('1d6+@key')).toEqual([]);
		expect(statsInFormula('1d6+@strengthSave')).toEqual([]);
		expect(statsInFormula('')).toEqual([]);
		expect(statsInFormula(null)).toEqual([]);
	});
});

describe('swapStatInFormula', () => {
	it('swaps each reference of the stat and keeps the other parts', () => {
		expect(swapStatInFormula('1d8+@strength+2+@strength', 'strength', 'dexterity')).toBe(
			'1d8+@dexterity+2+@dexterity',
		);
	});

	it('leaves a longer key as it is', () => {
		expect(swapStatInFormula('1d8+@strengthSave', 'strength', 'will')).toBe('1d8+@strengthSave');
	});
});

describe('statsOfRoll', () => {
	it('reads the stat of a skill from the config', () => {
		expect(statsOfRoll({ kind: 'skillCheck', key: 'might' })).toEqual(['strength']);
		expect(statsOfRoll({ kind: 'skillCheck', key: 'stealth' })).toEqual(['dexterity']);
		expect(statsOfRoll({ kind: 'skillCheck', key: 'perception' })).toEqual(['will']);
	});

	it('reads the key of a save or an ability check, the stats of an attack, and none on Initiative', () => {
		expect(statsOfRoll({ kind: 'save', key: 'will' })).toEqual(['will']);
		expect(statsOfRoll({ kind: 'abilityCheck', key: 'strength' })).toEqual(['strength']);
		expect(statsOfRoll({ kind: 'attack', delivery: 'melee', stats: ['dexterity'] })).toEqual([
			'dexterity',
		]);
		expect(statsOfRoll({ kind: 'attack', delivery: 'melee' })).toEqual([]);
		expect(statsOfRoll({ kind: 'initiative', key: '' })).toEqual([]);
	});
});

describe('moveLabelledModifier', () => {
	it('moves and renames the labelled part, and keeps the others', () => {
		expect(moveLabelledModifier('1d20 + 3[Strength Mod] + 2', 'Strength Mod', 'Will Mod', -2)).toBe(
			'1d20 + 1[Will Mod] + 2',
		);
	});

	it('writes a negative value with the operator', () => {
		expect(moveLabelledModifier('2d20kln + 1[Might Mod]', 'Might Mod', 'Might Mod', -3)).toBe(
			'2d20kln - 2[Might Mod]',
		);
		expect(moveLabelledModifier('1d20 - 1[A]', 'A', 'B', 3)).toBe('1d20 + 2[B]');
	});

	it('drops a part that becomes 0', () => {
		expect(moveLabelledModifier('1d20 + 2[A] + 1', 'A', 'B', -2)).toBe('1d20 + 1');
	});

	it('adds a part when the formula has none, as for a modifier of 0', () => {
		expect(moveLabelledModifier('1d20', 'A', 'B', 2)).toBe('1d20 + 2[B]');
		expect(moveLabelledModifier('1d20', 'A', 'B', -1)).toBe('1d20 - 1[B]');
		expect(moveLabelledModifier('1d20', 'A', 'B', 0)).toBe('1d20');
	});
});
