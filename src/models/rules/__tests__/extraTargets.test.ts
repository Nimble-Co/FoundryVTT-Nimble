import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ExtraTargetsRule } from '../extraTargets.js';

function extraTargets(data: Record<string, unknown>, options: { embedded?: boolean } = {}) {
	const actor = { uuid: 'Actor.hero', getDomain: () => new Set<string>() };
	const parent = {
		isEmbedded: options.embedded ?? true,
		actor,
		name: 'Wide Reach',
		uuid: 'Actor.hero.Item.wide',
		getDomain: () => new Set<string>(),
	};
	const rule = new ExtraTargetsRule(
		{ type: 'extraTargets' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, {
		attackOrigin: '',
		count: 1,
		reach: 0,
		...data,
		predicate: new Predicate({}),
	});
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

describe('ExtraTargetsRule', () => {
	it('starts as one more target, any reach, for no attack', () => {
		const schema = ExtraTargetsRule.defineSchema() as unknown as Record<
			string,
			{ options: { initial: unknown } }
		>;
		expect(schema.attackOrigin?.options.initial).toBe('');
		expect(schema.count?.options.initial).toBe(1);
		expect(schema.reach?.options.initial).toBe(0);
	});

	it('gives more targets to an attack made through the named item', () => {
		const rule = extraTargets({ attackOrigin: 'flurry', count: 2, reach: 3 });

		expect(rule.extraTargetsFor('flurry')).toEqual({ source: 'Wide Reach', count: 2, reach: 3 });
	});

	it('gives nothing to another attack, or when no item is named', () => {
		expect(extraTargets({ attackOrigin: 'flurry' }).extraTargetsFor('other')).toBeNull();
		expect(extraTargets({ attackOrigin: 'flurry' }).extraTargetsFor(undefined)).toBeNull();
		expect(extraTargets({ attackOrigin: '' }).extraTargetsFor('flurry')).toBeNull();
	});

	it('gives nothing while its item is not on a creature, or while it is off', () => {
		expect(
			extraTargets({ attackOrigin: 'flurry' }, { embedded: false }).extraTargetsFor('flurry'),
		).toBeNull();
		expect(
			extraTargets({ attackOrigin: 'flurry', disabled: true }).extraTargetsFor('flurry'),
		).toBeNull();
	});
});
