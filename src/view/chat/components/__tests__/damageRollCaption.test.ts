import { describe, expect, it } from 'vitest';
import { damageOutcomeMultiplier, damageRollCaption } from '../damageRollCaption.ts';

const caption = (input: Partial<Parameters<typeof damageRollCaption>[0]>) =>
	damageRollCaption({
		outcome: 'fullDamage',
		ignoreArmor: false,
		rollMode: 0,
		damageMultiplier: 1,
		...input,
	});

describe('damageRollCaption', () => {
	it('is empty for a plain hit', () => {
		expect(caption({})).toBe('');
	});

	it('tells the roll mode', () => {
		expect(caption({ rollMode: 2 })).toBe('Advantage x 2');
		expect(caption({ rollMode: -1 })).toBe('Disadvantage x 1');
	});

	it('tells half damage and armor that does not count', () => {
		expect(caption({ outcome: 'halfDamage' })).toBe('(Half Damage)');
		expect(caption({ outcome: 'halfDamage', ignoreArmor: true, rollMode: 1 })).toBe(
			'Advantage x 1 (Half Damage, Ignores Armor)',
		);
		expect(caption({ ignoreArmor: true })).toBe('(Ignores Armor)');
	});

	it('says nothing of the damage on a miss: the header says Miss', () => {
		expect(caption({ outcome: 'noDamage' })).toBe('');
		expect(caption({ outcome: 'noDamage', ignoreArmor: true })).toBe('(Ignores Armor)');
	});

	it('adds a damage multiplier', () => {
		expect(caption({ damageMultiplier: 2 })).toBe('x2 damage');
	});
});

describe('damageOutcomeMultiplier', () => {
	it('counts half damage as half, and shows a miss as rolled', () => {
		expect(damageOutcomeMultiplier('fullDamage')).toBe(1);
		expect(damageOutcomeMultiplier(undefined)).toBe(1);
		expect(damageOutcomeMultiplier('halfDamage')).toBe(0.5);
		expect(damageOutcomeMultiplier('noDamage')).toBe(1);
		expect(damageOutcomeMultiplier('other')).toBe(0);
	});
});
