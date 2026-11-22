import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { GrantTargetBonusRule } from '../grantTargetBonus.js';

function targetBonus(data: Record<string, unknown>, options: { embedded?: boolean } = {}) {
	const actor = { uuid: 'Actor.hero', getDomain: () => new Set<string>() };
	const parent = {
		isEmbedded: options.embedded ?? true,
		actor,
		name: 'Experienced Commander',
		uuid: 'Actor.hero.Item.experienced',
		getDomain: () => new Set<string>(),
	};
	const rule = new GrantTargetBonusRule(
		{ type: 'grantTargetBonus' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { grantIdentifier: '', count: 1, ...data, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

describe('GrantTargetBonusRule', () => {
	it('starts as one more target for no item', () => {
		const schema = GrantTargetBonusRule.defineSchema() as unknown as Record<
			string,
			{ options: { initial: unknown } }
		>;
		expect(schema.grantIdentifier?.options.initial).toBe('');
		expect(schema.count?.options.initial).toBe(1);
	});

	it('raises the count of the named item', () => {
		const rule = targetBonus({ grantIdentifier: 'coordinated-strike', count: 2 });

		expect(rule.bonusFor('coordinated-strike')).toBe(2);
	});

	it('raises nothing for another item, or when no item is named', () => {
		expect(targetBonus({ grantIdentifier: 'coordinated-strike' }).bonusFor('other')).toBe(0);
		expect(targetBonus({ grantIdentifier: '' }).bonusFor('')).toBe(0);
	});

	it('raises nothing while its item is not on a creature, or while it is off', () => {
		const named = { grantIdentifier: 'coordinated-strike' };
		expect(targetBonus(named, { embedded: false }).bonusFor('coordinated-strike')).toBe(0);
		expect(targetBonus({ ...named, disabled: true }).bonusFor('coordinated-strike')).toBe(0);
	});
});
