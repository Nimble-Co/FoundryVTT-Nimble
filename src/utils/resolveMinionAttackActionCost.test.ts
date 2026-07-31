import { describe, expect, it } from 'vitest';
import resolveMinionAttackActionCost from './resolveMinionAttackActionCost.js';

describe('resolveMinionAttackActionCost', () => {
	it('defaults to 1 when the item is null', () => {
		expect(resolveMinionAttackActionCost(null)).toBe(1);
	});

	it('defaults to 1 when the activation cost is missing', () => {
		expect(resolveMinionAttackActionCost({ system: { activation: {} } })).toBe(1);
	});

	it('defaults to 1 when the cost type is missing', () => {
		expect(
			resolveMinionAttackActionCost({ system: { activation: { cost: { quantity: 2 } } } }),
		).toBe(1);
	});

	it('defaults to 1 when the cost type is none', () => {
		expect(
			resolveMinionAttackActionCost({
				system: { activation: { cost: { type: 'none', quantity: 1 } } },
			}),
		).toBe(1);
	});

	it('returns 0 for an explicit zero action cost', () => {
		expect(
			resolveMinionAttackActionCost({
				system: { activation: { cost: { type: 'action', quantity: 0 } } },
			}),
		).toBe(0);
	});

	it('returns the authored quantity for action costs', () => {
		expect(
			resolveMinionAttackActionCost({
				system: { activation: { cost: { type: 'action', quantity: 2 } } },
			}),
		).toBe(2);
	});
});
