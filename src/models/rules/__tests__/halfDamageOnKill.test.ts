import { describe, expect, it } from 'vitest';
import { HalfDamageOnKillRule } from '../halfDamageOnKill.js';

function createRule(options: { embedded?: boolean; predicatePasses?: boolean } = {}) {
	const actor = {
		system: {} as Record<string, unknown>,
		getDomain: () => new Set<string>(),
	};
	const item = {
		isEmbedded: options.embedded ?? true,
		actor,
		name: 'Go for the Throat',
		uuid: 'Item.throat',
		getDomain: () => new Set<string>(),
	};
	const rule = new HalfDamageOnKillRule(
		{
			type: 'halfDamageOnKill',
			disabled: false,
			label: 'Half on a kill',
			id: 'lgThroatSplash',
			identifier: '',
			priority: 5,
			predicate: {},
			reach: 4,
		} as never,
		{ parent: item as never, strict: false },
	);
	Object.assign(rule, { reach: 4 });
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	const predicatePasses = options.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	return rule;
}

describe('HalfDamageOnKillRule', () => {
	it('starts at a reach of 4', () => {
		const schema = HalfDamageOnKillRule.defineSchema() as unknown as Record<
			string,
			{ options: { initial: unknown } }
		>;
		expect(schema.reach?.options.initial).toBe(4);
	});

	it('offers a reach of 4 while the rule applies', () => {
		expect(createRule().halfOnKill()).toBe(4);
	});

	it('offers nothing when the item is not on an actor', () => {
		expect(createRule({ embedded: false }).halfOnKill()).toBeNull();
	});

	it('offers nothing when its condition fails', () => {
		expect(createRule({ predicatePasses: false }).halfOnKill()).toBeNull();
	});
});
