import { describe, expect, it } from 'vitest';
import { signedNumber, spacedSignedNumber } from '../signedNumber.ts';

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

describe('the minus sign', () => {
	it('is the true minus sign U+2212, not a hyphen', () => {
		expect(signedNumber(-1).codePointAt(0)).toBe(0x2212);
		expect(spacedSignedNumber(-1).codePointAt(0)).toBe(0x2212);
	});
});
