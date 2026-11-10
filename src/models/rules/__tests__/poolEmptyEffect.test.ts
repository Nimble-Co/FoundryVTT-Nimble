import { describe, expect, it } from 'vitest';
import { PoolEmptyEffectRule } from '../poolEmptyEffect.js';

interface RuleConfig {
	disabled?: boolean;
	predicatePasses?: boolean;
	isEmbedded?: boolean;
}

function createPoolEmptyEffectRule(config: RuleConfig = {}): PoolEmptyEffectRule {
	const item = {
		isEmbedded: config.isEmbedded ?? true,
		actor: { getDomain: () => new Set<string>() },
		name: 'Item',
		getDomain: () => new Set<string>(),
	};
	const rule = new PoolEmptyEffectRule(
		{ id: 'rule-id', type: 'poolEmptyEffect', chargePoolIdentifier: 'plating' } as never,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);
	rule.disabled = config.disabled ?? false;
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	return rule;
}

describe('PoolEmptyEffectRule.isLive', () => {
	it('is live on an actor when its predicate passes', () => {
		expect(createPoolEmptyEffectRule().isLive()).toBe(true);
	});

	it('is not live when its item is not on an actor', () => {
		expect(createPoolEmptyEffectRule({ isEmbedded: false }).isLive()).toBe(false);
	});

	it('is not live when disabled', () => {
		expect(createPoolEmptyEffectRule({ disabled: true }).isLive()).toBe(false);
	});

	it('is not live when its predicate fails', () => {
		expect(createPoolEmptyEffectRule({ predicatePasses: false }).isLive()).toBe(false);
	});
});
