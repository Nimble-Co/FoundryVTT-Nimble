import { describe, expect, it } from 'vitest';

import { hpGained, woundsGained } from '../actorHpChangePaths.js';

function actor(hp: number, wounds: number, max = 20) {
	return {
		system: { attributes: { hp: { value: hp, max, temp: 0 }, wounds: { value: wounds } } },
	};
}

function options(previous: { hp?: number; wounds?: number }) {
	return {
		nimble: {
			...(previous.hp === undefined
				? {}
				: { previousHp: { value: previous.hp, max: 20, temp: 0 } }),
			...(previous.wounds === undefined ? {} : { previousWounds: previous.wounds }),
		},
	};
}

describe('woundsGained', () => {
	it('counts the wounds the update added', () => {
		expect(woundsGained(actor(0, 2), options({ wounds: 1 }))).toBe(1);
	});

	it('is 0 when the update removed wounds', () => {
		expect(woundsGained(actor(5, 0), options({ wounds: 2 }))).toBe(0);
	});

	it('is 0 when the update did not record the wounds before it', () => {
		expect(woundsGained(actor(0, 2), {})).toBe(0);
	});
});

describe('hpGained', () => {
	it('counts the HP the update added', () => {
		expect(hpGained(actor(15, 0), options({ hp: 9 }))).toBe(6);
	});

	it('is 0 when HP went down', () => {
		expect(hpGained(actor(4, 0), options({ hp: 9 }))).toBe(0);
	});

	it('is 0 when the update did not record the HP before it', () => {
		expect(hpGained(actor(15, 0), undefined)).toBe(0);
	});

	it('does not count HP that only follows a higher max HP, as on a level up', () => {
		expect(hpGained(actor(25, 0, 25), options({ hp: 20 }))).toBe(0);
	});

	it('counts the HP above the max HP rise', () => {
		expect(hpGained(actor(18, 0, 25), options({ hp: 10 }))).toBe(3);
	});

	describe('when the update says how much HP follows the higher max HP', () => {
		/** A level up raises max HP in an earlier update, so this one records the new max. */
		function levelUpOptions(hp: number, following: number) {
			return { nimble: { previousHp: { value: hp, max: 25, temp: 0 }, hpFollowingMax: following } };
		}

		it('does not count that HP', () => {
			expect(hpGained(actor(15, 0, 25), levelUpOptions(10, 5))).toBe(0);
		});

		it('counts the HP above it', () => {
			expect(hpGained(actor(20, 0, 25), levelUpOptions(10, 5))).toBe(5);
		});
	});
});
