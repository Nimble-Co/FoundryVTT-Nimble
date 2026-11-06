import { describe, expect, it } from 'vitest';
import { isSheetIntent } from '../sheetIntent.ts';

describe('isSheetIntent', () => {
	it('is true for an intent both sheets share, false for one sheet only', () => {
		expect(isSheetIntent({ kind: 'setHp', value: 3 })).toBe(true);
		expect(isSheetIntent({ kind: 'setFlag', flag: 'x', value: true })).toBe(true);
		expect(isSheetIntent({ kind: 'setMaxHp', value: 3 })).toBe(false);
		expect(isSheetIntent({ kind: 'levelUp' })).toBe(false);
	});
});
