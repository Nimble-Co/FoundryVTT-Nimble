import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { KeepAmountRule } from '../keepAmount.js';

function make(parent: object = { isEmbedded: true, name: 'Rampage', uuid: 'Item.rampage' }) {
	const rule = new KeepAmountRule(
		{ type: 'keepAmount', id: 'r1' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), id: 'r1' });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Keep Amount rule', () => {
	it('is a row on a hit, 1/turn', () => {
		const rule = make();
		expect(rule.rollEffect).toBe('keepAmount');
		expect(rule.outcome).toBe('hit');
		expect(rule.oncePerAttack).toBe(true);
		expect(rule.rollUseCost.turnUseKey).toBe('Item.rampage:r1');
	});

	it('is offered only on the attack of its owner', () => {
		const rule = make();
		const attack = { kind: 'attack' };
		expect(rule.offersUseOn({ side: 'roller', roll: attack } as never)).toBe(true);
		expect(rule.offersUseOn({ side: 'target', roll: attack } as never)).toBe(false);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'save' } } as never)).toBe(false);
	});
});
