import { describe, expect, it } from 'vitest';
import { resolveCombatantCurrentActionsAfterDelta } from './combatTurnActions.js';

describe('resolveCombatantCurrentActionsAfterDelta', () => {
	it('clamps increases at max actions', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 9,
				maxActions: 10,
				delta: 1,
			}),
		).toBe(10);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 10,
				maxActions: 10,
				delta: 1,
			}),
		).toBe(10);
	});

	it('clamps decreases at zero actions', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 1,
				maxActions: 10,
				delta: -1,
			}),
		).toBe(0);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 0,
				maxActions: 10,
				delta: -1,
			}),
		).toBe(0);
	});

	it('normalizes invalid and float values before applying delta', () => {
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 3.8,
				maxActions: 7.2,
				delta: 1.9,
			}),
		).toBe(4);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: Number.NaN,
				maxActions: 5,
				delta: 1,
			}),
		).toBe(1);
		expect(
			resolveCombatantCurrentActionsAfterDelta({
				currentActions: 6,
				maxActions: 4,
				delta: -1,
			}),
		).toBe(4);
	});
});
