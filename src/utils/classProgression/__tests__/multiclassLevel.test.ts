import { describe, expect, it } from 'vitest';

import {
	characterLevel,
	classMaximumHp,
	countsAsStartingClass,
	levelUpAtCap,
	uniqueHighestClassIdentifier,
} from '../multiclassLevel.js';

describe('levelUpAtCap', () => {
	it('closes level up when the hero has no class', () => {
		expect(levelUpAtCap([], false)).toBe(true);
		expect(levelUpAtCap([], true)).toBe(true);
	});

	it('uses the first class level when multiclassing is off', () => {
		expect(levelUpAtCap([19, 1], false)).toBe(false);
		expect(levelUpAtCap([20], false)).toBe(true);
		expect(levelUpAtCap([20, 0], false)).toBe(true);
	});

	it('uses the sum of class levels when multiclassing is on', () => {
		expect(levelUpAtCap([19, 1], true)).toBe(true);
		expect(levelUpAtCap([4, 1], true)).toBe(false);
		expect(levelUpAtCap([20], true)).toBe(true);
	});
});

describe('characterLevel', () => {
	it('adds the class levels', () => {
		expect(characterLevel([4, 1])).toBe(5);
		expect(characterLevel([])).toBe(0);
	});
});

describe('uniqueHighestClassIdentifier', () => {
	it('returns the only class that is strictly highest', () => {
		expect(
			uniqueHighestClassIdentifier([
				{ identifier: 'berserker', level: 4 },
				{ identifier: 'commander', level: 1 },
			]),
		).toBe('berserker');
	});

	it('returns null when the highest level is shared', () => {
		expect(
			uniqueHighestClassIdentifier([
				{ identifier: 'berserker', level: 4 },
				{ identifier: 'commander', level: 4 },
			]),
		).toBeNull();
	});

	it('returns null when there is no class', () => {
		expect(uniqueHighestClassIdentifier([])).toBeNull();
	});
});

describe('class hit points', () => {
	it('counts starting hit points for the starting class and for a class that is not on a character', () => {
		expect(
			countsAsStartingClass({
				embedded: true,
				startingClassIdentifier: 'berserker',
				classIdentifier: 'berserker',
			}),
		).toBe(true);
		expect(
			countsAsStartingClass({
				embedded: false,
				startingClassIdentifier: 'berserker',
				classIdentifier: 'commander',
			}),
		).toBe(true);
		expect(
			countsAsStartingClass({
				embedded: true,
				startingClassIdentifier: '',
				classIdentifier: 'commander',
			}),
		).toBe(true);
	});

	it('skips starting hit points for a later class', () => {
		expect(
			countsAsStartingClass({
				embedded: true,
				startingClassIdentifier: 'berserker',
				classIdentifier: 'commander',
			}),
		).toBe(false);
		expect(classMaximumHp({ countsStartingHp: false, startingHp: 17, hpData: [8] })).toBe(8);
		expect(classMaximumHp({ countsStartingHp: true, startingHp: 20, hpData: [12, 9] })).toBe(41);
	});
});
