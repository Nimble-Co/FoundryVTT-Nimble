import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DamageRoll } from '../DamageRoll.js';
import { PrimaryDie } from '../terms/PrimaryDie.js';

/** A Multi-target Attack roll whose Primary Die shows `face`, read from that face. */
function multiTarget(face: number) {
	const roll = new DamageRoll(
		'1d6+2',
		{},
		{
			canCrit: false,
			canMiss: false,
			multiTarget: true,
			rollMode: 0,
			primaryDieValue: 0,
			primaryDieModifier: 0,
		},
	);
	const die = roll.primaryDie as PrimaryDie;
	die.results = [{ result: face, active: true }];
	Object.assign(die, { _evaluated: true });
	Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
	roll.refreshOutcome();
	return roll;
}

describe('a Multi-target Attack roll', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('keeps a Primary Die that does not explode', () => {
		const roll = multiTarget(3);

		expect(roll.primaryDie).toBeInstanceOf(PrimaryDie);
		expect(roll.primaryDie?.modifiers).not.toContain('x');
	});

	it('does not crit on the max and does not miss on a 1', () => {
		expect(multiTarget(6).isCritical).toBe(false);
		expect(multiTarget(1).isMiss).toBe(false);
	});
});
