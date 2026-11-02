import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDamageBack } from '../cardDamageBack.js';

describe('damage back of the crit dice', () => {
	const attack = (critDiceTotal: number) => ({ isCritical: true, critDiceTotal });
	const setup = () => {
		const attacker = { uuid: 'Actor.a', name: 'Rook', applyDamage: vi.fn() };
		const update = vi.fn(async () => undefined);
		const host = { id: () => 'c', attacker: () => attacker, records: () => [], update };
		const rule = { type: 'damageBack', amount: 'critDice', answersAttack: () => true };
		return { attacker, update, back: new CardDamageBack(host), rule };
	};

	beforeEach(() => {
		(globalThis as any).game.settings = { get: () => true };
	});

	it('deals what the crit dice came to, not the damage taken', async () => {
		const { attacker, back, rule, update } = setup();
		await back.afterDamage([{ actor: { uuid: 'Actor.m', rules: [rule] }, taken: 30 }], attack(7));
		expect(attacker.applyDamage).toHaveBeenCalledWith(7);
		expect(update).toHaveBeenCalled();
	});

	it('deals nothing when no crit dice came', async () => {
		const { attacker, back, rule, update } = setup();
		await back.afterDamage([{ actor: { uuid: 'Actor.m', rules: [rule] }, taken: 30 }], attack(0));
		expect(attacker.applyDamage).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});
});
