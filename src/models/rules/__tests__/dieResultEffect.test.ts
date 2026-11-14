import { describe, expect, it } from 'vitest';
import { DieResultEffectRule } from '../dieResultEffect.js';

interface RuleConfig {
	disabled?: boolean;
	predicatePasses?: boolean;
	isEmbedded?: boolean;
	itemIdentifier?: string;
}

const OWN_UUID = 'Actor.a.Item.own';

function createRule(config: RuleConfig = {}): DieResultEffectRule {
	const item = {
		uuid: OWN_UUID,
		isEmbedded: config.isEmbedded ?? true,
		actor: { getDomain: () => new Set<string>() },
		name: 'Item',
		getDomain: () => new Set<string>(),
	};
	const rule = new DieResultEffectRule(
		{
			id: 'rule-id',
			type: 'dieResultEffect',
			itemIdentifier: config.itemIdentifier ?? 'spirit',
		} as never,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);
	rule.disabled = config.disabled ?? false;
	rule.itemIdentifier = config.itemIdentifier ?? 'spirit';
	rule.atLeast = 6;
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	return rule;
}

describe('DieResultEffectRule', () => {
	it('starts at a face of 6', () => {
		expect(DieResultEffectRule.defineSchema().atLeast).toMatchObject({ initial: 6 });
	});

	it('is live on an actor when its predicate passes', () => {
		expect(createRule().isLive()).toBe(true);
	});

	it('is not live when its item is not on an actor', () => {
		expect(createRule({ isEmbedded: false }).isLive()).toBe(false);
	});

	it('is not live when disabled', () => {
		expect(createRule({ disabled: true }).isLive()).toBe(false);
	});

	it('is not live when its predicate fails', () => {
		expect(createRule({ predicatePasses: false }).isLive()).toBe(false);
	});

	it('reads uses of the item with its identifier only', () => {
		const rule = createRule();
		expect(rule.readsUseOf({ uuid: 'x', system: { identifier: 'spirit' } })).toBe(true);
		expect(rule.readsUseOf({ uuid: 'y', system: { identifier: 'other' } })).toBe(false);
		expect(rule.readsUseOf(null)).toBe(false);
	});

	it('reads uses of its own item when the identifier is blank', () => {
		const rule = createRule({ itemIdentifier: '' });
		expect(rule.readsUseOf({ uuid: OWN_UUID, system: { identifier: '' } })).toBe(true);
		expect(rule.readsUseOf({ uuid: 'Actor.a.Item.other', system: { identifier: '' } })).toBe(false);
	});

	it('reads a bonus step of the damage of the named item', () => {
		const step = (fromItemIdentifier?: string) => ({
			id: 's',
			type: 'damage' as const,
			damageType: 'radiant',
			formula: '1d6',
			fromItemIdentifier,
			parentContext: null,
			parentNode: null,
		});
		expect(createRule().readsBonusOf([step('spirit')])).toBe(true);
		expect(createRule().readsBonusOf([step('other'), step()])).toBe(false);
		expect(createRule({ itemIdentifier: '' }).readsBonusOf([step('')])).toBe(false);
	});
});
