import { describe, expect, it } from 'vitest';

import { Predicate } from '../../etc/Predicate.js';
import { SkillPointMoveRule } from './skillPointMove.js';

interface RuleConfig {
	points?: number;
	trigger?: 'safeRest' | 'fieldRest';
	disabled?: boolean;
}

type TestRule = SkillPointMoveRule & {
	points: number;
	trigger: 'safeRest' | 'fieldRest';
	disabled: boolean;
	predicate: Predicate;
};

function createRule(config: RuleConfig = {}): TestRule {
	const sourceData = {
		points: config.points ?? 1,
		trigger: config.trigger ?? 'safeRest',
		disabled: config.disabled ?? false,
		label: '',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'skillPointMove',
	};

	const rule = new SkillPointMoveRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			SkillPointMoveRule['schema']['fields']
		>,
		{ parent: undefined, strict: false },
	) as TestRule;

	// The mock DataModel does not assign source data onto the instance.
	rule.points = sourceData.points;
	rule.trigger = sourceData.trigger;
	rule.disabled = sourceData.disabled;
	rule.predicate = new Predicate({});

	return rule;
}

describe('SkillPointMoveRule.offersMoveOn', () => {
	it('offers a move on the rest it names', () => {
		expect(createRule({ trigger: 'safeRest' }).offersMoveOn('safeRest')).toBe(true);
	});

	it('does not offer a move on a different rest', () => {
		expect(createRule({ trigger: 'safeRest' }).offersMoveOn('fieldRest')).toBe(false);
	});

	it('offers nothing when the point count is not positive', () => {
		expect(createRule({ points: 0 }).offersMoveOn('safeRest')).toBe(false);
	});

	it('does not offer a move when disabled', () => {
		expect(createRule({ disabled: true }).offersMoveOn('safeRest')).toBe(false);
	});

	it('carries the point count through, so content can offer more than one', () => {
		expect(createRule({ points: 3 }).points).toBe(3);
	});
});
