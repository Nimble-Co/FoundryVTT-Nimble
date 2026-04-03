import { describe, expect, it } from 'vitest';
import resolveItemActionCost from './resolveItemActionCost.js';

describe('resolveItemActionCost', () => {
	it('returns 1 when item is null', () => {
		expect(resolveItemActionCost(null)).toBe(1);
	});

	it('returns 1 when system is missing', () => {
		expect(resolveItemActionCost({} as Parameters<typeof resolveItemActionCost>[0])).toBe(1);
	});

	it('returns 1 when activation is missing', () => {
		expect(resolveItemActionCost({ system: {} })).toBe(1);
	});

	it('returns 1 when cost is missing', () => {
		expect(resolveItemActionCost({ system: { activation: {} } })).toBe(1);
	});

	it('returns 1 when cost type is not action', () => {
		expect(
			resolveItemActionCost({ system: { activation: { cost: { type: 'bonus', quantity: 2 } } } }),
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

	it('returns 1 when quantity is zero', () => {
		expect(
			resolveItemActionCost({
				system: { activation: { cost: { type: 'action', quantity: 0 } } },
			}),
		).toBe(1);
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
