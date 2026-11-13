import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { NimbleBaseRule } from '../base.js';
import { ZeroHpAtEndRule } from '../zeroHpAtEnd.js';

describe('ZeroHpAtEndRule', () => {
	it('works only on an effect, in the triggers group', () => {
		expect(ZeroHpAtEndRule.worksOnItems).toBe(false);
		expect(ZeroHpAtEndRule.worksOnEffects).toBe(true);
		expect(ZeroHpAtEndRule.group).toBe('triggers');
		expect(ZeroHpAtEndRule.description).toBe('NIMBLE.rules.zeroHpAtEnd.description');
	});

	it('has no fields of its own but its type', () => {
		const own = Object.keys(ZeroHpAtEndRule.defineSchema()).filter(
			(name) => !(name in NimbleBaseRule.defineSchema()),
		);
		expect(own).toEqual(['type']);
		const type = ZeroHpAtEndRule.defineSchema().type as unknown as { initial: string };
		expect(type.initial).toBe('zeroHpAtEnd');
	});

	it('is a rule type of the rules builder', () => {
		expect(CONFIG.NIMBLE.ruleDataModels.zeroHpAtEnd).toBe(ZeroHpAtEndRule);
		expect(RULE_CLASSES.zeroHpAtEnd).toBe(ZeroHpAtEndRule);
		expect(CONFIG.NIMBLE.ruleTypes.zeroHpAtEnd).toBe('0 HP at end');
	});
});
