import { describe, expect, it } from 'vitest';
import resolveItemActionCost from './resolveItemActionCost.js';

describe('resolveItemActionCost', () => {
	it('returns 0 when item is null', () => {
		expect(resolveItemActionCost(null)).toBe(0);
	});

	it('returns 0 when system is missing', () => {
		expect(resolveItemActionCost({} as Parameters<typeof resolveItemActionCost>[0])).toBe(0);
	});

	it('returns 0 when activation is missing', () => {
		expect(resolveItemActionCost({ system: {} })).toBe(0);
	});

	it('returns 0 when cost is missing', () => {
		expect(resolveItemActionCost({ system: { activation: {} } })).toBe(0);
	});

	it('returns 0 when cost type is not action', () => {
		expect(
			resolveItemActionCost({ system: { activation: { cost: { type: 'bonus', quantity: 2 } } } }),
		).toBe(0);
		expect(
			resolveItemActionCost({ system: { activation: { cost: { type: 'none', quantity: 1 } } } }),
		).toBe(0);
	});

	it('returns 1 when quantity is missing on an action cost', () => {
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action' } } },
			}),
		).toBe(1);
	});

	it('returns 1 when quantity is NaN', () => {
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: Number.NaN } } },
			}),
		).toBe(1);
	});

	it('returns 1 when quantity is negative', () => {
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: -1 } } },
			}),
		).toBe(1);
	});

	it('returns 0 when quantity is explicitly zero', () => {
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: 0 } } },
			}),
		).toBe(0);
	});

	it('returns the correct quantity for valid action costs', () => {
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: 1 } } },
			}),
		).toBe(1);
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: 2 } } },
			}),
		).toBe(2);
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: 5 } } },
			}),
		).toBe(5);
	});
});
