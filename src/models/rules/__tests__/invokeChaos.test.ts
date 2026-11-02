import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { InvokeChaosRule } from '../invokeChaos.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new InvokeChaosRule(
		{ type: 'invokeChaos' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), ...data });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Invoke Chaos rule', () => {
	it('lets the holder invoke Chaos', () => {
		expect(make({}).invokesChaos).toBe(true);
	});

	it('does not on an item that no hero holds', () => {
		expect(make({}, { isEmbedded: false }).invokesChaos).toBe(false);
	});

	it('does not when its condition does not hold', () => {
		expect(make({ test: () => false }).invokesChaos).toBe(false);
	});
});
