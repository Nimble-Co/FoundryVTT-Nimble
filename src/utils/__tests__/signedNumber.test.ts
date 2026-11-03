import { describe, expect, it } from 'vitest';
import { signedNumber, spacedSignedNumber, TRUE_MINUS } from '../signedNumber.ts';

describe('signedNumber', () => {
	it('writes the sign with no space and a true minus sign', () => {
		expect(signedNumber(3)).toBe('+3');
		expect(signedNumber(0)).toBe('+0');
		expect(signedNumber(-1)).toBe('−1');
	});
});

describe('spacedSignedNumber', () => {
	it('writes the sign with a space and a true minus sign', () => {
		expect(spacedSignedNumber(3)).toBe('+ 3');
		expect(spacedSignedNumber(0)).toBe('+ 0');
		expect(spacedSignedNumber(-0)).toBe('+ 0');
		expect(spacedSignedNumber(-1)).toBe('− 1');
	});
});

describe('TRUE_MINUS', () => {
	it('is U+2212', () => {
		expect(TRUE_MINUS).toBe('−');
	});
});
