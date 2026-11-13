import { describe, expect, it } from 'vitest';
import { HeldRollRule } from '../heldRoll.js';

const schema = HeldRollRule.defineSchema() as unknown as Record<
	string,
	{ options: { showWhen: (data: object) => boolean } }
>;
const shows = (field: string, data: object) => schema[field].options.showWhen(data);

describe('the Held Roll form', () => {
	it('shows only one of Melee only and Ranged only while the other is on', () => {
		expect(shows('rangedOnly', { meleeOnly: true })).toBe(false);
		expect(shows('meleeOnly', { rangedOnly: true })).toBe(false);
		expect(shows('meleeOnly', {})).toBe(true);
		expect(shows('rangedOnly', {})).toBe(true);
	});

	it('shows both when both are on, so one can be turned off', () => {
		const both = { meleeOnly: true, rangedOnly: true };
		expect(shows('meleeOnly', both)).toBe(true);
		expect(shows('rangedOnly', both)).toBe(true);
	});

	it('shows neither for a kind that no attack uses', () => {
		for (const heldKind of [
			'wholeAmount',
			'vulnerableOnce',
			'ignoreDisadvantage',
			'mustAttackOther',
		]) {
			expect(shows('meleeOnly', { heldKind })).toBe(false);
			expect(shows('rangedOnly', { heldKind })).toBe(false);
		}
		for (const heldKind of ['advantage', 'primaryDie', 'extraDamage', 'maximize']) {
			expect(shows('rangedOnly', { heldKind })).toBe(true);
		}
	});
});
