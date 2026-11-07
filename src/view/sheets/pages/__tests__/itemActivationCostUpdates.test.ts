import { describe, expect, it } from 'vitest';
import resolveItemActionCost from '#utils/combat/resolveItemActionCost.js';
import {
	costQuantityMin,
	costTypeUpdate,
	reactionFlagUpdate,
	showsCostQuantity,
} from '../itemActivationCostUpdates.js';

type Cost = { type: string; quantity: number; isReaction: boolean; details: string };

function apply(cost: Cost, update: Record<string, unknown>): Cost {
	const next = { ...cost };
	for (const [key, value] of Object.entries(update)) {
		const field = key.replace('system.activation.cost.', '') as keyof Cost;
		(next as Record<string, unknown>)[field] = value;
	}
	return next;
}

const cost = (overrides: Partial<Cost> = {}): Cost => ({
	type: 'none',
	quantity: 1,
	isReaction: false,
	details: '',
	...overrides,
});

describe('reactionFlagUpdate', () => {
	it('turns a no-cost item into a free reaction action cost', () => {
		expect(reactionFlagUpdate(cost(), true)).toEqual({
			'system.activation.cost.isReaction': true,
			'system.activation.cost.type': 'action',
			'system.activation.cost.quantity': 0,
		});
	});

	it('keeps the quantity of an action cost the author already set', () => {
		expect(reactionFlagUpdate(cost({ type: 'action', quantity: 2 }), true)).toEqual({
			'system.activation.cost.isReaction': true,
		});
	});

	it('only clears the flag when the author turns it off', () => {
		expect(
			reactionFlagUpdate(cost({ type: 'action', quantity: 0, isReaction: true }), false),
		).toEqual({ 'system.activation.cost.isReaction': false });
	});

	it('never writes type none with the reaction flag', () => {
		const result = apply(cost(), reactionFlagUpdate(cost(), true));
		expect(result.type).not.toBe('none');
		expect(resolveItemActionCost({ system: { activation: { cost: result } } })).toBe(0);
	});

	it('turns a time or special cost into a usual reaction of 1 action', () => {
		for (const type of ['minute', 'hour', 'special', 'turn']) {
			expect(reactionFlagUpdate(cost({ type, quantity: 10 }), true)).toEqual({
				'system.activation.cost.isReaction': true,
				'system.activation.cost.type': 'action',
				'system.activation.cost.quantity': 1,
			});
		}
	});

	it('leaves the trigger details alone', () => {
		const before = cost({ details: 'when Bloodied' });
		expect(apply(before, reactionFlagUpdate(before, true)).details).toBe('when Bloodied');
	});
});

describe('costTypeUpdate', () => {
	it('writes the picked type when the cost is not a reaction', () => {
		expect(costTypeUpdate(cost({ type: 'action' }), 'none')).toEqual({
			'system.activation.cost.type': 'none',
		});
	});

	it('reads none on a reaction as a free reaction', () => {
		expect(costTypeUpdate(cost({ type: 'action', isReaction: true }), 'none')).toEqual({
			'system.activation.cost.type': 'action',
			'system.activation.cost.quantity': 0,
		});
	});

	it('ends the reaction when the author picks a type that is not an action', () => {
		for (const type of ['minute', 'hour', 'special', 'turn']) {
			expect(costTypeUpdate(cost({ type: 'action', quantity: 2, isReaction: true }), type)).toEqual(
				{ 'system.activation.cost.type': type, 'system.activation.cost.isReaction': false },
			);
		}
	});

	it('keeps the reaction when the author picks action', () => {
		expect(costTypeUpdate(cost({ type: 'action', isReaction: true }), 'action')).toEqual({
			'system.activation.cost.type': 'action',
		});
	});
});

describe('showsCostQuantity', () => {
	it('shows the quantity box for action, minute and hour', () => {
		expect(showsCostQuantity('action')).toBe(true);
		expect(showsCostQuantity('minute')).toBe(true);
		expect(showsCostQuantity('hour')).toBe(true);
	});

	it('hides the quantity box for none, special and a missing type', () => {
		expect(showsCostQuantity('none')).toBe(false);
		expect(showsCostQuantity('special')).toBe(false);
		expect(showsCostQuantity(undefined)).toBe(false);
	});

	it('shows the quantity box for a reaction made from a no-cost item', () => {
		const result = apply(cost(), reactionFlagUpdate(cost(), true));
		expect(showsCostQuantity(result.type)).toBe(true);
	});
});

describe('costQuantityMin', () => {
	it('lets an action cost be 0 and time units start at 1', () => {
		expect(costQuantityMin('action')).toBe(0);
		expect(costQuantityMin('minute')).toBe(1);
		expect(costQuantityMin('hour')).toBe(1);
	});
});
