import { describe, expect, it } from 'vitest';
import {
	getEndableConditions,
	getNodeOptions,
	toggleListedCondition,
} from '../itemActivationEffectsConfigTabHelpers.js';

const values = (node: { type?: string } | null) => getNodeOptions(node).map(({ value }) => value);

describe('getNodeOptions', () => {
	it('offers a Wound step at the root, under a damage and under a save', () => {
		expect(values(null)).toContain('wound');
		expect(values({ type: 'damage' })).toContain('wound');
		expect(values({ type: 'savingThrow' })).toContain('wound');
	});

	it('offers an End Conditions step in the same three places', () => {
		expect(values(null)).toContain('endConditions');
		expect(values({ type: 'damage' })).toContain('endConditions');
		expect(values({ type: 'savingThrow' })).toContain('endConditions');
		expect(getNodeOptions(null).find(({ value }) => value === 'endConditions')?.label).toBe(
			'End Conditions',
		);
	});

	it('names the Wound step in the picker', () => {
		expect(getNodeOptions(null).find(({ value }) => value === 'wound')?.label).toBe('Wound');
	});
});

describe('the End Conditions step editor', () => {
	it('lists every condition but the states the system sets', () => {
		const ids = getEndableConditions().map(({ value }) => value);

		expect(ids).toEqual(expect.arrayContaining(['dazed', 'grappled', 'invisible']));
		expect(ids).not.toContain('concentration');
		expect(ids).not.toContain('dying');
		expect(ids).not.toContain('wounded');
	});

	it('adds a condition to the list, and takes it out again', () => {
		expect(toggleListedCondition(['dazed'], 'poisoned')).toEqual(['dazed', 'poisoned']);
		expect(toggleListedCondition(['dazed', 'poisoned'], 'dazed')).toEqual(['poisoned']);
	});
});
