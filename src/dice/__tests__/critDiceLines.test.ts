import { describe, expect, it } from 'vitest';
import { dieRoleOf, isCritD20Result } from '../critDiceLines.js';

describe('the crit marks on dice', () => {
	it('gives the role of a term a crit added', () => {
		expect(dieRoleOf({ options: { dieRole: 'critBonus', critDiceKey: 'rule' } })).toBe('critBonus');
	});

	it('gives no role for a term with none', () => {
		expect(dieRoleOf({ options: { flavor: 'Fire' } })).toBeUndefined();
		expect(dieRoleOf({})).toBeUndefined();
		expect(dieRoleOf(null)).toBeUndefined();
	});

	it('finds the d20 crit die by the faces of its result', () => {
		expect(isCritD20Result({ result: 14, active: true, faces: 20 })).toBe(true);
	});

	it('a result with no faces of its own is not the d20 crit die', () => {
		expect(isCritD20Result({ result: 6, active: true })).toBe(false);
		expect(isCritD20Result(undefined)).toBe(false);
	});
});
