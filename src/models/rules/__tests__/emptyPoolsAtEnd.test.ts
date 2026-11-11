import { describe, expect, it } from 'vitest';
import { EmptyPoolsAtEndRule } from '../emptyPoolsAtEnd.js';

function emptyPoolsRule(pools: string[]): EmptyPoolsAtEndRule {
	const rule = new EmptyPoolsAtEndRule({ type: 'emptyPoolsAtEnd', pools } as never, {
		strict: false,
	});
	Object.assign(rule, { pools });
	return rule;
}

describe('EmptyPoolsAtEndRule', () => {
	it('is offered only on effects, under resources', () => {
		expect(EmptyPoolsAtEndRule.worksOnItems).toBe(false);
		expect(EmptyPoolsAtEndRule.worksOnEffects).toBe(true);
		expect(EmptyPoolsAtEndRule.group).toBe('resource');
		expect(EmptyPoolsAtEndRule.description).toBe('NIMBLE.rules.emptyPoolsAtEnd.description');
	});

	it('has a list of pool identifiers', () => {
		expect(EmptyPoolsAtEndRule.defineSchema()).toHaveProperty('pools');
	});

	it('names its pools with blanks and spaces left out', () => {
		expect(emptyPoolsRule([' fury ', '', '  ', 'focus']).poolIdentifiers).toEqual([
			'fury',
			'focus',
		]);
	});
});
