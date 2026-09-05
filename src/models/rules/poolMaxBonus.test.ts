import { describe, expect, it } from 'vitest';

import { Predicate } from '../../etc/Predicate.js';
import { PoolMaxBonusRule } from './poolMaxBonus.js';

interface RuleConfig {
	poolIdentifier?: string;
	amount?: number;
	disabled?: boolean;
}

type TestRule = PoolMaxBonusRule & {
	poolIdentifier: string;
	amount: number;
	disabled: boolean;
	predicate: Predicate;
};

function createRule(config: RuleConfig = {}): TestRule {
	const sourceData = {
		poolIdentifier: config.poolIdentifier ?? 'combat-dice',
		amount: config.amount ?? 1,
		disabled: config.disabled ?? false,
		label: '',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'poolMaxBonus',
	};

	const rule = new PoolMaxBonusRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<PoolMaxBonusRule['schema']['fields']>,
		{ parent: undefined, strict: false },
	) as TestRule;

	// The mock DataModel does not assign source data onto the instance.
	rule.poolIdentifier = sourceData.poolIdentifier;
	rule.amount = sourceData.amount;
	rule.disabled = sourceData.disabled;
	rule.predicate = new Predicate({});

	return rule;
}

describe('PoolMaxBonusRule.appliesToPool', () => {
	it('applies to the pool it names', () => {
		expect(createRule({ poolIdentifier: 'combat-dice' }).appliesToPool('combat-dice')).toBe(true);
	});

	it('does not apply to a different pool', () => {
		expect(createRule({ poolIdentifier: 'combat-dice' }).appliesToPool('fury')).toBe(false);
	});

	it('tolerates surrounding whitespace on the authored identifier', () => {
		expect(createRule({ poolIdentifier: ' combat-dice ' }).appliesToPool('combat-dice')).toBe(true);
	});

	it('does not apply when the amount is zero', () => {
		expect(createRule({ amount: 0 }).appliesToPool('combat-dice')).toBe(false);
	});

	it('applies with a negative amount, so a rule can lower a maximum', () => {
		expect(createRule({ amount: -1 }).appliesToPool('combat-dice')).toBe(true);
	});

	it('does not apply when disabled', () => {
		expect(createRule({ disabled: true }).appliesToPool('combat-dice')).toBe(false);
	});
});

describe('PoolMaxBonusRule class metadata', () => {
	it('declares itself early-phase so the late-predicate guardrails apply', () => {
		expect(PoolMaxBonusRule.appliesInPrePrepareData).toBe(true);
	});
});
