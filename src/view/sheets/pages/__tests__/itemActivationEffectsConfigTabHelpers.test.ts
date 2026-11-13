import { describe, expect, it } from 'vitest';
import { getNodeOptions } from '../itemActivationEffectsConfigTabHelpers.js';

const values = (node: { type?: string } | null) => getNodeOptions(node).map(({ value }) => value);

describe('getNodeOptions', () => {
	it('offers a Wound step at the root, under a damage and under a save', () => {
		expect(values(null)).toContain('wound');
		expect(values({ type: 'damage' })).toContain('wound');
		expect(values({ type: 'savingThrow' })).toContain('wound');
	});

	it('names the Wound step in the picker', () => {
		expect(getNodeOptions(null).find(({ value }) => value === 'wound')?.label).toBe('Wound');
	});
});
