import { describe, expect, it } from 'vitest';
import { type AttackOutcomeCharge, attackOutcomeChargesToSpend } from '../collectAttackOutcome.js';

interface RollShape {
	isCritical?: boolean;
	primaryDieValue?: number;
	primaryDie?: { faces?: number };
	anyDieAtMax?: boolean;
	options?: { forceMiss?: boolean; missThreshold?: number };
}

const hit = (face: number, extra: Partial<RollShape> = {}): RollShape => ({
	isCritical: false,
	primaryDieValue: face,
	primaryDie: { faces: 8 },
	anyDieAtMax: false,
	options: {},
	...extra,
});

const charge = (...gave: AttackOutcomeCharge['gave']): AttackOutcomeCharge => ({
	identifier: 'pool',
	gave,
});

describe('attackOutcomeChargesToSpend', () => {
	it('spends nothing for a crit on a hit when the attack misses', () => {
		expect(
			attackOutcomeChargesToSpend([charge('forcedCritOnHit')], hit(1, { isCritical: false })),
		).toEqual([]);
	});

	it('spends for a crit on a hit that gave the crit', () => {
		expect(
			attackOutcomeChargesToSpend([charge('forcedCritOnHit')], hit(4, { isCritical: true })),
		).toEqual(['pool']);
	});

	it('spends nothing for any-die crits with no die at max', () => {
		expect(attackOutcomeChargesToSpend([charge('anyDieCrits')], hit(4))).toEqual([]);
	});

	it('spends for any-die crits with a die at max', () => {
		expect(
			attackOutcomeChargesToSpend(
				[charge('anyDieCrits')],
				hit(4, { isCritical: true, anyDieAtMax: true }),
			),
		).toEqual(['pool']);
	});

	it('spends nothing for cannot miss when the face is no miss', () => {
		expect(attackOutcomeChargesToSpend([charge('cannotMiss')], hit(2))).toEqual([]);
	});

	it('spends for cannot miss on a miss face, and reads a raised miss threshold', () => {
		expect(attackOutcomeChargesToSpend([charge('cannotMiss')], hit(1))).toEqual(['pool']);
		expect(
			attackOutcomeChargesToSpend(
				[charge('cannotMiss')],
				hit(2, { options: { missThreshold: 2 } }),
			),
		).toEqual(['pool']);
	});

	it('spends for an "always" crit, but not when the attack was made to miss', () => {
		expect(
			attackOutcomeChargesToSpend([charge('forcedCritAlways')], hit(1, { isCritical: true })),
		).toEqual(['pool']);
		expect(
			attackOutcomeChargesToSpend(
				[charge('forcedCritAlways')],
				hit(1, { options: { forceMiss: true } }),
			),
		).toEqual([]);
	});

	it('spends for a crit range only on a face below the max that crits', () => {
		expect(
			attackOutcomeChargesToSpend([charge('critRange')], hit(7, { isCritical: true })),
		).toEqual(['pool']);
		expect(
			attackOutcomeChargesToSpend([charge('critRange')], hit(8, { isCritical: true })),
		).toEqual([]);
		expect(attackOutcomeChargesToSpend([charge('critRange')], hit(5))).toEqual([]);
	});

	it('spends one charge for a rule that gave two things', () => {
		expect(
			attackOutcomeChargesToSpend(
				[charge('cannotMiss', 'forcedCritOnHit')],
				hit(1, { isCritical: false }),
			),
		).toEqual(['pool']);
	});

	it('spends nothing with no roll', () => {
		expect(attackOutcomeChargesToSpend([charge('cannotMiss')], null)).toEqual([]);
	});
});
