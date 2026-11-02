import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ChaosOptionsRule } from '../chaosOptions.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new ChaosOptionsRule(
		{ type: 'chaosOptions' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), ...data });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Chaos Options rule', () => {
	it('applies on a held item with its condition', () => {
		expect(make({}).applies).toBe(true);
		expect(make({}, { isEmbedded: false }).applies).toBe(false);
		expect(make({ test: () => false }).applies).toBe(false);
	});
});
