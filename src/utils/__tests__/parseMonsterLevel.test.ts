import { describe, expect, it } from 'vitest';
import parseMonsterLevel from '../parseMonsterLevel.js';

describe('parseMonsterLevel', () => {
	it.each([
		['5', 5],
		['14', 14],
		['1/2', 0.5],
		['1/4', 0.25],
		[' 1 / 3 ', 1 / 3],
		[3, 3],
	])('reads %j as %d', (input, expected) => {
		expect(parseMonsterLevel(input)).toBe(expected);
	});

	it.each([[''], ['abc'], ['1/0'], ['-2'], [null], [undefined], [Number.NaN]])(
		'gives undefined for %j',
		(input) => {
			expect(parseMonsterLevel(input)).toBeUndefined();
		},
	);
});
