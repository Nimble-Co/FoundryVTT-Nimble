import { describe, expect, it } from 'vitest';
import formatActivationCostLabel from './formatActivationCostLabel.js';

describe('formatActivationCostLabel', () => {
	it('renders a single action', () => {
		expect(formatActivationCostLabel({ type: 'action', quantity: 1 })).toBe('1 Action');
	});

	it('pluralises multiple actions', () => {
		expect(formatActivationCostLabel({ type: 'action', quantity: 2 })).toBe('2 Actions');
		expect(formatActivationCostLabel({ type: 'action', quantity: 3 })).toBe('3 Actions');
	});

	it('renders an explicit zero action cost as Free', () => {
		expect(formatActivationCostLabel({ type: 'action', quantity: 0 })).toBe('Free');
	});

	it('renders the elapsed-time units', () => {
		expect(formatActivationCostLabel({ type: 'minute', quantity: 1 })).toBe('1 Minute');
		expect(formatActivationCostLabel({ type: 'minute', quantity: 10 })).toBe('10 Minutes');
		expect(formatActivationCostLabel({ type: 'hour', quantity: 1 })).toBe('1 Hour');
		expect(formatActivationCostLabel({ type: 'hour', quantity: 24 })).toBe('24 Hours');
	});

	it('never renders an elapsed-time unit as Free', () => {
		// `min: 0` is shared across every cost type, so a clamped zero can reach
		// here; a single unit is the closest sensible reading of "0 minutes".
		expect(formatActivationCostLabel({ type: 'minute', quantity: 0 })).toBe('1 Minute');
		expect(formatActivationCostLabel({ type: 'hour', quantity: 0 })).toBe('1 Hour');
	});

	it('defaults a missing quantity to a single unit', () => {
		expect(formatActivationCostLabel({ type: 'action' })).toBe('1 Action');
		expect(formatActivationCostLabel({ type: 'minute' })).toBe('1 Minute');
	});

	it('returns null for the cost types that carry no quantity', () => {
		expect(formatActivationCostLabel({ type: 'none', quantity: 1 })).toBeNull();
		expect(formatActivationCostLabel({ type: 'special', quantity: 1 })).toBeNull();
	});

	describe('reactions', () => {
		it('names the reaction rather than counting actions at the default cost', () => {
			expect(formatActivationCostLabel({ type: 'action', quantity: 1, isReaction: true })).toBe(
				'Reaction',
			);
		});

		it('spells out an action cost above the default of one', () => {
			// One reaction costing two actions, never "2 Reactions".
			expect(formatActivationCostLabel({ type: 'action', quantity: 2, isReaction: true })).toBe(
				'Reaction (2 Actions)',
			);
			expect(formatActivationCostLabel({ type: 'action', quantity: 3, isReaction: true })).toBe(
				'Reaction (3 Actions)',
			);
		});

		it('renders a zero-cost reaction as a free reaction', () => {
			expect(formatActivationCostLabel({ type: 'action', quantity: 0, isReaction: true })).toBe(
				'Free Reaction',
			);
		});

		it('reads the legacy reaction cost type the same way', () => {
			// Authored before `isReaction` split "what it costs" from "when you pay
			// it"; these used to render the literal string "undefined".
			expect(formatActivationCostLabel({ type: 'reaction', quantity: 1 })).toBe('Reaction');
			expect(formatActivationCostLabel({ type: 'reaction', quantity: 2 })).toBe(
				'Reaction (2 Actions)',
			);
			expect(formatActivationCostLabel({ type: 'reaction' })).toBe('Reaction');
		});

		it('ignores the flag on an elapsed-time cost, which is not a reaction', () => {
			expect(formatActivationCostLabel({ type: 'minute', quantity: 10, isReaction: true })).toBe(
				'10 Minutes',
			);
		});
	});

	it('returns null for a missing or empty cost', () => {
		expect(formatActivationCostLabel(null)).toBeNull();
		expect(formatActivationCostLabel(undefined)).toBeNull();
		expect(formatActivationCostLabel({})).toBeNull();
	});
});
