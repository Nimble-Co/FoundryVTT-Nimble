import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { giveBack, payCost, receiptOf, spendMana } from '../costLedger.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: ReturnType<typeof vi.fn> } };
};

function caster(current: number) {
	const actor = {
		system: { resources: { mana: { current, max: 10 } } },
		update: vi.fn(async (changes: Record<string, number>) => {
			actor.system.resources.mana.current = changes['system.resources.mana.current'];
		}),
	};
	return actor;
}

function manaCost(manaCost: number) {
	return {
		chargePoolIdentifier: '',
		chargeCost: 0,
		manaCost,
		woundCost: 0,
		heroicReaction: '' as const,
	};
}

describe('cost ledger', () => {
	beforeEach(() => {
		testGlobals.game.settings = { get: vi.fn(() => true) };
	});
	afterEach(() => {
		testGlobals.game.settings = undefined;
	});

	it('takes Mana only when the caster has enough', async () => {
		const actor = caster(2);

		expect(await spendMana(actor as never, 3)).toBe(false);
		expect(actor.update).not.toHaveBeenCalled();
		expect(await spendMana(actor as never, 2)).toBe(true);
		expect(actor.system.resources.mana.current).toBe(0);
	});

	it('gives back the Mana a cost took', async () => {
		const actor = caster(5);
		const cost = manaCost(3);

		const paid = await payCost(actor as never, cost);
		expect(actor.system.resources.mana.current).toBe(2);
		await giveBack(actor as never, { cost, paid: paid! });

		expect(actor.system.resources.mana.current).toBe(5);
	});

	it('refuses a Mana cost the caster cannot pay', async () => {
		const actor = caster(1);

		expect(await payCost(actor as never, manaCost(3))).toBeNull();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('gives back nothing for a use that cost nothing', async () => {
		const actor = caster(5);
		await giveBack(actor as never, receiptOf());

		expect(actor.update).not.toHaveBeenCalled();
	});
});
