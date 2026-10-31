import { describe, expect, it, vi } from 'vitest';
import {
	attacksMadeThisTurn,
	countsAsAttack,
	recordAttack,
	rollsWithRushedDisadvantage,
} from '../rushedAttacks.ts';

const ACTOR = { id: 'hero' };

function combatOnTurnOf(actorId: string, flag?: unknown) {
	const combatant = {
		actorId,
		getFlag: vi.fn(() => flag),
		setFlag: vi.fn(async () => undefined),
	};
	return { started: true, round: 2, turn: 1, combatant };
}

describe('which items are attacks', () => {
	const item = (type: string, attackType: string, effects: { type: string }[] = []) => ({
		type,
		system: { activation: { targets: { attackType }, effects } },
	});
	const damageSpell = item('spell', '', [{ type: 'damage' }]);
	const saveSpell = item('spell', '', [{ type: 'savingThrow' }, { type: 'damage' }]);

	it('counts a weapon or feature with a reach or range attack, and a spell that does damage', () => {
		expect(countsAsAttack(item('object', 'reach'))).toBe(true);
		expect(countsAsAttack(item('feature', 'range'))).toBe(true);
		expect(countsAsAttack(damageSpell)).toBe(true);
		expect(countsAsAttack(saveSpell)).toBe(true);
	});

	it('does not count an item with no attack, or a spell with no damage', () => {
		expect(countsAsAttack(item('feature', ''))).toBe(false);
		expect(countsAsAttack(item('spell', '', [{ type: 'condition' }]))).toBe(false);
	});

	it('gives the disadvantage to a roll by the attacker, not to a spell with a save', () => {
		expect(rollsWithRushedDisadvantage(item('object', 'reach'))).toBe(true);
		expect(rollsWithRushedDisadvantage(damageSpell)).toBe(true);
		expect(rollsWithRushedDisadvantage(saveSpell)).toBe(false);
	});
});

describe('attacksMadeThisTurn', () => {
	it('is the count of this turn', () => {
		const combat = combatOnTurnOf('hero', { round: 2, turn: 1, count: 2 });

		expect(attacksMadeThisTurn(ACTOR, combat)).toBe(2);
	});

	it('starts again on a new turn', () => {
		const combat = combatOnTurnOf('hero', { round: 1, turn: 1, count: 3 });

		expect(attacksMadeThisTurn(ACTOR, combat)).toBe(0);
	});

	it('is 0 on the turn of another creature and with no combat', () => {
		const combat = combatOnTurnOf('goblin', { round: 2, turn: 1, count: 3 });

		expect(attacksMadeThisTurn(ACTOR, combat)).toBe(0);
		expect(attacksMadeThisTurn(ACTOR, null)).toBe(0);
	});
});

describe('recordAttack', () => {
	it('adds one to the count of this turn', async () => {
		const combat = combatOnTurnOf('hero', { round: 2, turn: 1, count: 1 });

		await recordAttack(ACTOR, combat);

		expect(combat.combatant.setFlag).toHaveBeenCalledWith(expect.any(String), 'attacksThisTurn', {
			round: 2,
			turn: 1,
			count: 2,
		});
	});

	it('records nothing on the turn of another creature', async () => {
		const combat = combatOnTurnOf('goblin');

		await recordAttack(ACTOR, combat);

		expect(combat.combatant.setFlag).not.toHaveBeenCalled();
	});
});
