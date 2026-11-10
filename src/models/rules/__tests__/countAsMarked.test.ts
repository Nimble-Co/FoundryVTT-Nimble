import { describe, expect, it } from 'vitest';
import { type CountAsMarkedDelivery, CountAsMarkedRule } from '../countAsMarked.js';

interface RuleConfig {
	flagKey?: string;
	delivery?: CountAsMarkedDelivery;
	disabled?: boolean;
	predicatePasses?: boolean;
}

function createCountAsMarkedRule(config: RuleConfig = {}): CountAsMarkedRule {
	const item = {
		isEmbedded: true,
		actor: { getDomain: () => new Set<string>() },
		name: 'Item',
		getDomain: () => new Set<string>(),
	};
	const rule = new CountAsMarkedRule(
		{
			id: 'rule-id',
			type: 'countAsMarked',
			flagKey: config.flagKey ?? 'quarry',
			delivery: config.delivery ?? 'melee',
		} as never,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);
	rule.flagKey = config.flagKey ?? 'quarry';
	rule.delivery = config.delivery ?? 'melee';
	rule.disabled = config.disabled ?? false;
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	return rule;
}

describe('CountAsMarkedRule.markedTagFor', () => {
	it('gives the target tag for an attack of its delivery', () => {
		expect(createCountAsMarkedRule().markedTagFor('melee')).toBe('target:quarry');
	});

	it('gives no tag for an attack of another delivery', () => {
		expect(createCountAsMarkedRule().markedTagFor('ranged')).toBeNull();
	});

	it('gives no tag for an attack with no delivery', () => {
		expect(createCountAsMarkedRule({ delivery: 'any' }).markedTagFor(null)).toBeNull();
		expect(createCountAsMarkedRule({ delivery: 'any' }).markedTagFor(undefined)).toBeNull();
	});

	it('gives the tag for melee and ranged attacks when the delivery is any', () => {
		const rule = createCountAsMarkedRule({ delivery: 'any' });
		expect(rule.markedTagFor('melee')).toBe('target:quarry');
		expect(rule.markedTagFor('ranged')).toBe('target:quarry');
	});

	it('uses the trimmed flag key', () => {
		expect(createCountAsMarkedRule({ flagKey: ' hunted ' }).markedTagFor('melee')).toBe(
			'target:hunted',
		);
	});

	it('gives no tag with a blank flag key', () => {
		expect(createCountAsMarkedRule({ flagKey: '  ' }).markedTagFor('melee')).toBeNull();
	});

	it('gives no tag when disabled', () => {
		expect(createCountAsMarkedRule({ disabled: true }).markedTagFor('melee')).toBeNull();
	});

	it('gives no tag when its predicate fails', () => {
		expect(createCountAsMarkedRule({ predicatePasses: false }).markedTagFor('melee')).toBeNull();
	});
});
