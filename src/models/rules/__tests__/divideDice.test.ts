import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { DivideDiceRule } from '../divideDice.js';

function divideDice(data: Record<string, unknown>, options: { embedded?: boolean } = {}) {
	const actor = { uuid: 'Actor.hero', getDomain: () => new Set<string>() };
	const parent = {
		isEmbedded: options.embedded ?? true,
		actor,
		name: 'Grim Harrow',
		uuid: 'Actor.hero.Item.harrow',
		getDomain: () => new Set<string>(),
	};
	const rule = new DivideDiceRule(
		{ type: 'divideDice' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { attackOrigin: '', ...data, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

describe('DivideDiceRule', () => {
	it('starts for no attack', () => {
		const schema = DivideDiceRule.defineSchema() as unknown as Record<
			string,
			{ options: { initial: unknown } }
		>;
		expect(schema.attackOrigin?.options.initial).toBe('');
	});

	it('divides the dice of an attack made through the named item', () => {
		expect(divideDice({ attackOrigin: 'scythe' }).dividesDiceFor('scythe')).toEqual({
			source: 'Grim Harrow',
		});
	});

	it('does not divide the dice of another attack, or when no item is named', () => {
		expect(divideDice({ attackOrigin: 'scythe' }).dividesDiceFor('other')).toBeNull();
		expect(divideDice({ attackOrigin: 'scythe' }).dividesDiceFor(undefined)).toBeNull();
		expect(divideDice({ attackOrigin: '' }).dividesDiceFor('scythe')).toBeNull();
	});

	it('does not divide while its item is not on a creature, or while it is off', () => {
		expect(
			divideDice({ attackOrigin: 'scythe' }, { embedded: false }).dividesDiceFor('scythe'),
		).toBeNull();
		expect(
			divideDice({ attackOrigin: 'scythe', disabled: true }).dividesDiceFor('scythe'),
		).toBeNull();
	});
});
