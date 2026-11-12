import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { DamageRecoilRule } from '../damageRecoil.js';

function makeRule(config: Record<string, unknown> = {}, isEmbedded = true) {
	const actor = { uuid: 'Actor.ogre', getDomain: () => new Set<string>() };
	const item = { isEmbedded, actor, name: 'Bloodcursed', getDomain: () => new Set<string>() };
	const rule = new DamageRecoilRule({ type: 'damageRecoil' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, { disabled: false, multiplier: 2, predicate: new Predicate({}), ...config });
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	return rule;
}

describe('DamageRecoilRule', () => {
	it('is the damage dealt times the multiplier, rounded down', () => {
		expect(makeRule().recoilFor(7)).toBe(14);
		expect(makeRule({ multiplier: 0.5 }).recoilFor(7)).toBe(3);
	});

	it('is 0 with no damage dealt', () => {
		expect(makeRule().recoilFor(0)).toBe(0);
	});

	it('is 0 on an item that is not on a creature', () => {
		expect(makeRule({}, false).recoilFor(7)).toBe(0);
	});
});
