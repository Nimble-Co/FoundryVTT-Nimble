import { describe, expect, it } from 'vitest';
import { foldBonusIntoPrimaryDamage } from './foldBonusIntoPrimaryDamage.js';

function damageRoll(overrides: Record<string, unknown> = {}) {
	return {
		class: 'DamageRoll',
		formula: '1d6 + 2',
		total: 8,
		isCritical: true,
		terms: [
			{
				class: 'Die',
				number: 1,
				faces: 6,
				evaluated: true,
				results: [{ result: 6, active: true, discarded: false }],
			},
			{ class: 'OperatorTerm', operator: '+', evaluated: true },
			{ class: 'NumericTerm', number: 2, evaluated: true },
		],
		...overrides,
	};
}

function activationWith(roll: Record<string, unknown> | null) {
	return {
		effects: roll
			? [{ id: 'damage-node', type: 'damage', parentNode: null, parentContext: null, roll }]
			: [],
	};
}

describe('foldBonusIntoPrimaryDamage', () => {
	it('adds the bonus to the serialized total', () => {
		const roll = damageRoll();
		const result = foldBonusIntoPrimaryDamage(
			activationWith(roll),
			[JSON.stringify(roll)],
			18,
			'Death Blow',
		);

		const effects = result?.activation.effects as Array<{ roll: { total: number } }>;
		expect(effects[0].roll.total).toBe(26);
	});

	it('appends a flavored numeric term so the armor pipeline reads it as dice', () => {
		const roll = damageRoll();
		const result = foldBonusIntoPrimaryDamage(
			activationWith(roll),
			[JSON.stringify(roll)],
			18,
			'Death Blow',
		);

		const effects = result?.activation.effects as Array<{
			roll: { terms: Array<Record<string, unknown>> };
		}>;
		const terms = effects[0].roll.terms;

		expect(terms.slice(-2)).toEqual([
			{ class: 'OperatorTerm', operator: '+', evaluated: true, options: {} },
			{ class: 'NumericTerm', number: 18, evaluated: true, options: { flavor: 'Death Blow' } },
		]);
	});

	it('keeps the message rolls entry in lockstep with the node roll', () => {
		const roll = damageRoll();
		const result = foldBonusIntoPrimaryDamage(
			activationWith(roll),
			[JSON.stringify(roll)],
			7,
			'Death Blow',
		);

		expect(result?.rolls).toHaveLength(1);
		const patched = JSON.parse(result?.rolls[0] ?? '{}') as {
			total: number;
			terms: Array<Record<string, unknown>>;
		};
		expect(patched.total).toBe(15);
		expect(patched.terms).toHaveLength(5);
	});

	it('replaces the DamageRoll entry rather than the other rolls on the card', () => {
		const roll = damageRoll();
		const healingRoll = JSON.stringify({ class: 'Roll', total: 4 });
		const result = foldBonusIntoPrimaryDamage(
			activationWith(roll),
			[healingRoll, JSON.stringify(roll)],
			5,
			'Death Blow',
		);

		expect(result?.rolls[0]).toBe(healingRoll);
		expect(JSON.parse(result?.rolls[1] ?? '{}').total).toBe(13);
	});

	it('appends when the rolls source does not yet carry the damage roll', () => {
		const roll = damageRoll();
		const result = foldBonusIntoPrimaryDamage(activationWith(roll), [], 5, 'Death Blow');

		expect(result?.rolls).toHaveLength(1);
		expect(JSON.parse(result?.rolls[0] ?? '{}').total).toBe(13);
	});

	it('preserves the crit flag the damage pipeline branches on', () => {
		const roll = damageRoll();
		const result = foldBonusIntoPrimaryDamage(
			activationWith(roll),
			[JSON.stringify(roll)],
			18,
			'Death Blow',
		);

		const effects = result?.activation.effects as Array<{ roll: { isCritical: boolean } }>;
		expect(effects[0].roll.isCritical).toBe(true);
	});

	it('returns null when the card has no primary damage roll', () => {
		expect(foldBonusIntoPrimaryDamage(activationWith(null), [], 18, 'Death Blow')).toBeNull();
	});

	it('returns null when the only damage node carries a non-DamageRoll', () => {
		const plainRoll = { class: 'Roll', total: 4, terms: [] };

		expect(foldBonusIntoPrimaryDamage(activationWith(plainRoll), [], 18, 'Death Blow')).toBeNull();
	});

	it('does not mutate the rolls array it was handed', () => {
		const roll = damageRoll();
		const rollsSource = [JSON.stringify(roll)];
		foldBonusIntoPrimaryDamage(activationWith(roll), rollsSource, 18, 'Death Blow');

		expect(JSON.parse(rollsSource[0]).total).toBe(8);
	});
});
