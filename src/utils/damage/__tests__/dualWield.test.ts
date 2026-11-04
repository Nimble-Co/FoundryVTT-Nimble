import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	dualWieldOfferFor,
	dualWieldRollOptions,
	markDualWieldUse,
	otherWeaponOf,
	rollModeOfWeapon,
} from '../dualWield.js';

const weapon = (id: string, formula: string, equipped = true) => ({
	id,
	uuid: `Item.${id}`,
	name: id,
	type: 'object',
	system: {
		objectType: 'weapon',
		equipped,
		activation: { effects: [{ type: 'damage', formula, damageType: 'slashing' }] },
	},
});

function hero(items: ReturnType<typeof weapon>[], flag?: string) {
	return { items, getFlag: () => flag, update: vi.fn(async () => {}) };
}

describe('the Dual wield tick', () => {
	beforeEach(() => {
		vi.stubGlobal('game', { combat: { started: true, id: 'c', round: 2 } });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('shows with 2 equipped weapons, with no check of Light or STR', () => {
		const sword = weapon('sword', '1d8');
		const axe = weapon('axe', '1d6');
		expect(dualWieldOfferFor(hero([sword, axe]), sword)).toEqual({
			other: { uuid: 'Item.axe', name: 'axe' },
			used: false,
		});
	});

	it('is advantage with the same formula, whatever the names are', () => {
		const sword = weapon('sword', '1d8 + @strength');
		const other = weapon('falchion', '1D8+@strength');
		expect(dualWieldOfferFor(hero([sword, other]), sword)).toEqual({ other: null, used: false });
	});

	it('does not show with one equipped weapon', () => {
		const sword = weapon('sword', '1d8');
		expect(dualWieldOfferFor(hero([sword, weapon('axe', '1d6', false)]), sword)).toBeNull();
	});

	it('does not show for a weapon that is not equipped', () => {
		const sword = weapon('sword', '1d8', false);
		expect(dualWieldOfferFor(hero([sword, weapon('axe', '1d6')]), sword)).toBeNull();
	});

	it('shows on an Unarmed Strike as advantage, which has no item', () => {
		const unarmed = { system: { activation: { effects: [{ type: 'damage', formula: '1d4' }] } } };
		expect(dualWieldOfferFor(hero([]), unarmed)).toEqual({ other: null, used: false });
	});

	it('says the use was spent this round, 1/round', async () => {
		const sword = weapon('sword', '1d8');
		const items = [sword, weapon('axe', '1d6')];
		expect(dualWieldOfferFor(hero(items, 'c:2'), sword)?.used).toBe(true);
		expect(dualWieldOfferFor(hero(items, 'c:1'), sword)?.used).toBe(false);

		const actor = hero(items);
		await markDualWieldUse(actor);
		expect(actor.update).toHaveBeenCalledWith({ [`flags.${SYSTEM_ID}.dualWieldRound`]: 'c:2' });
	});

	it('has no limit outside combat', () => {
		vi.stubGlobal('game', { combat: null });
		const sword = weapon('sword', '1d8');
		expect(dualWieldOfferFor(hero([sword, weapon('axe', '1d6')], 'c:2'), sword)?.used).toBe(false);
	});
});

describe('the extra die of a different weapon', () => {
	it('stays on the weapon the player picks', () => {
		expect(rollModeOfWeapon(1, 'activated', 'activated')).toBe(1);
		expect(rollModeOfWeapon(1, 'activated', 'other')).toBe(0);
		expect(rollModeOfWeapon(1, 'other', 'activated')).toBe(0);
		expect(rollModeOfWeapon(1, 'other', 'other')).toBe(1);
	});

	it('leaves no advantage and disadvantage as they are', () => {
		expect(rollModeOfWeapon(0, 'other', 'activated')).toBe(0);
		expect(rollModeOfWeapon(-1, 'other', 'activated')).toBe(-1);
		expect(rollModeOfWeapon(-1, 'other', 'other')).toBe(-1);
	});
});

describe('a reroll of a dual wield attack', () => {
	const sword = { itemUuid: 'Item.sword', label: 'Sword', damageType: 'slashing' };
	const axe = { itemUuid: 'Item.axe', label: 'Axe', damageType: 'piercing' };

	it('rolls the other weapon, and names this weapon for the next reroll', () => {
		const options = dualWieldRollOptions({ rollMode: 1 }, sword, {
			...axe,
			formula: '1d6',
			options: { rollMode: 0 },
		});

		const next = otherWeaponOf({ originalFormula: '1d8', options } as never);

		expect(next?.formula).toBe('1d6');
		expect(next?.options).toMatchObject({
			rollMode: 0,
			dualWieldSelf: axe,
			dualWieldOther: { ...sword, formula: '1d8', options: { rollMode: 1 } },
		});
	});

	it('does nothing on a roll of one weapon', () => {
		expect(otherWeaponOf({ options: {} })).toBeNull();
	});
});
