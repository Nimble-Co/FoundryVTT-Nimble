import { describe, expect, it } from 'vitest';
import { poolCountText } from '../poolCountText.js';

describe('poolCountText', () => {
	it('shows the count and the maximum', () => {
		expect(poolCountText(3, 5)).toBe('3/5');
		expect(poolCountText(0, 2, false)).toBe('0/2');
	});

	it('shows the count alone when the pool hides its maximum', () => {
		expect(poolCountText(4, 99, true)).toBe('4');
	});
});
