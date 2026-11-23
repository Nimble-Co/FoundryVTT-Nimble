import { describe, expect, it } from 'vitest';
import { AdditionalMarkRule } from '../additionalMark.js';

describe('AdditionalMarkRule', () => {
	it('follows the quarry list and offers a creature within 6 spaces', () => {
		const schema = AdditionalMarkRule.defineSchema() as unknown as Record<
			string,
			{ options: { initial: unknown; min?: unknown } }
		>;

		expect(schema.flagKey?.options.initial).toBe('quarry');
		expect(schema.within?.options.initial).toBe(6);
		expect(schema.within?.options.min).toBe(1);
		expect(AdditionalMarkRule.worksOnEffects).toBe(false);
		expect(AdditionalMarkRule.group).toBe('triggers');
		expect(AdditionalMarkRule.icon).toBe('fa-solid fa-crosshairs');
		expect(AdditionalMarkRule.description).toBe('NIMBLE.rules.additionalMark.description');
	});
});
