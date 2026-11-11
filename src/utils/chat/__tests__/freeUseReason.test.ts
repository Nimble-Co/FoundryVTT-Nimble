import { describe, expect, it } from 'vitest';
import { freeUseReasonText } from '../freeUseReason.ts';

describe('freeUseReasonText', () => {
	it('localizes the line and each data value that is a lang key', () => {
		const text = freeUseReasonText({
			key: 'NIMBLE.rules.useItemFree.cardLine',
			data: {
				trigger: { key: 'NIMBLE.rules.useItemFree.reasons.onMiss' },
				feature: 'Second Wind',
			},
		});

		expect(text).toBe('For free: you missed an attack (Second Wind)');
	});

	it('shows the text of an older card as it is, and nothing for no line', () => {
		expect(freeUseReasonText('For free: old line')).toBe('For free: old line');
		expect(freeUseReasonText(undefined)).toBe('');
		expect(freeUseReasonText({ data: {} })).toBe('');
	});
});
