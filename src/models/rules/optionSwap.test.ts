import { describe, expect, it } from 'vitest';

import { Predicate } from '../../etc/Predicate.js';
import { ALL_GROUPS, OptionSwapRule } from './optionSwap.js';

interface RuleConfig {
	selectionGroups?: string[];
	trigger?: 'safeRest' | 'fieldRest';
	disabled?: boolean;
}

type TestRule = OptionSwapRule & {
	selectionGroups: string[];
	trigger: 'safeRest' | 'fieldRest';
	disabled: boolean;
	predicate: Predicate;
};

function createRule(config: RuleConfig = {}): TestRule {
	const sourceData = {
		selectionGroups: config.selectionGroups ?? [ALL_GROUPS],
		trigger: config.trigger ?? 'safeRest',
		disabled: config.disabled ?? false,
		label: '',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'optionSwap',
	};

	const rule = new OptionSwapRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<OptionSwapRule['schema']['fields']>,
		{ parent: undefined, strict: false },
	) as TestRule;

	// The mock DataModel does not assign source data onto the instance.
	rule.selectionGroups = sourceData.selectionGroups;
	rule.trigger = sourceData.trigger;
	rule.disabled = sourceData.disabled;
	rule.predicate = new Predicate({});

	return rule;
}

describe('OptionSwapRule.offersSwapOn', () => {
	it('offers a swap on the rest it names', () => {
		expect(createRule({ trigger: 'safeRest' }).offersSwapOn('safeRest')).toBe(true);
	});

	it('does not offer a swap on a different rest', () => {
		expect(createRule({ trigger: 'safeRest' }).offersSwapOn('fieldRest')).toBe(false);
	});

	it('supports a field rest trigger, so content is not locked to safe rests', () => {
		expect(createRule({ trigger: 'fieldRest' }).offersSwapOn('fieldRest')).toBe(true);
	});

	it('offers nothing when no pool is named', () => {
		expect(createRule({ selectionGroups: [] }).offersSwapOn('safeRest')).toBe(false);
	});

	it('does not offer a swap when disabled', () => {
		expect(createRule({ disabled: true }).offersSwapOn('safeRest')).toBe(false);
	});
});

describe('OptionSwapRule group coverage', () => {
	it("treats 'all' as every pool the class offers", () => {
		const rule = createRule({ selectionGroups: [ALL_GROUPS] });
		expect(rule.coversAllGroups).toBe(true);
		expect(rule.namedGroups).toEqual([]);
	});

	it('reports explicitly named pools', () => {
		const rule = createRule({ selectionGroups: ['savage-arsenal', 'combat-tactics'] });
		expect(rule.coversAllGroups).toBe(false);
		expect(rule.namedGroups).toEqual(['savage-arsenal', 'combat-tactics']);
	});

	it("lets 'all' win when it sits alongside named pools", () => {
		const rule = createRule({ selectionGroups: ['savage-arsenal', ALL_GROUPS] });
		expect(rule.coversAllGroups).toBe(true);
		expect(rule.namedGroups).toEqual([]);
	});

	it('drops blank and whitespace-only group names', () => {
		const rule = createRule({ selectionGroups: [' savage-arsenal ', '', '   '] });
		expect(rule.namedGroups).toEqual(['savage-arsenal']);
	});
});
