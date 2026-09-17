import { describe, expect, it, vi } from 'vitest';
import {
	getEquipmentSwapMax,
	getEquipmentSwapsRemaining,
	spendEquipmentSwap,
} from './equipmentSwaps.js';
import type { EquipmentActor } from './weaponHands.js';

function actor(equipmentSwapBonus = 0): EquipmentActor {
	return {
		items: { filter: () => [] },
		system: { attributes: { equipmentSwapBonus } },
	};
}

function combatant(round: number, spent: number) {
	return {
		id: 'c1',
		type: 'character',
		system: { equipmentSwaps: { round, spent } },
		update: vi.fn().mockResolvedValue(undefined),
	};
}

const combat = (round: number) => ({ round, combatants: { find: () => null } });

describe('getEquipmentSwapMax', () => {
	it('is one per round by default', () => {
		expect(getEquipmentSwapMax(actor())).toBe(1);
	});

	it('is two for a Commander with Weapon Mastery', () => {
		expect(getEquipmentSwapMax(actor(1))).toBe(2);
	});
});

describe('getEquipmentSwapsRemaining', () => {
	it('subtracts swaps spent this round', () => {
		expect(getEquipmentSwapsRemaining(actor(), combatant(3, 1), combat(3))).toBe(0);
		expect(getEquipmentSwapsRemaining(actor(1), combatant(3, 1), combat(3))).toBe(1);
	});

	it('resets when the round advances', () => {
		expect(getEquipmentSwapsRemaining(actor(), combatant(3, 1), combat(4))).toBe(1);
	});

	it('is unbudgeted outside combat, where there are no rounds', () => {
		expect(getEquipmentSwapsRemaining(actor(), null, null)).toBe(Number.POSITIVE_INFINITY);
	});
});

describe('spendEquipmentSwap', () => {
	it('stamps the current round and increments the count', async () => {
		const hero = combatant(3, 1);
		await spendEquipmentSwap(hero, combat(3));

		expect(hero.update).toHaveBeenCalledWith({
			'system.equipmentSwaps.round': 3,
			'system.equipmentSwaps.spent': 2,
		});
	});

	it('restarts the count in a new round', async () => {
		const hero = combatant(3, 1);
		await spendEquipmentSwap(hero, combat(4));

		expect(hero.update).toHaveBeenCalledWith({
			'system.equipmentSwaps.round': 4,
			'system.equipmentSwaps.spent': 1,
		});
	});
});
