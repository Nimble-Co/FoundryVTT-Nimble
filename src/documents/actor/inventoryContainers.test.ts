import { describe, expect, it } from 'vitest';

import type { ContainableObject } from '#types/inventoryContainers.js';
import {
	createContainer as makeContainer,
	createContainableObject as makeObject,
} from '../../../tests/fixtures/containableObject.js';
import {
	calculateInventorySlotCost,
	findContainerStorageRejection,
	getContainerUsedCapacity,
} from './inventoryContainers.js';

describe('calculateInventorySlotCost slot costs', () => {
	it('uses the stored slot count for slot-sized objects', () => {
		expect(calculateInventorySlotCost([makeObject('sword', { slotsRequired: 2 })])).toBe(2);
	});

	it('charges one slot per started stack for stackable objects', () => {
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			quantity: 25,
			stackSize: 20,
		});

		expect(calculateInventorySlotCost([arrows])).toBe(2);
	});

	it('charges every small object carried loose a single shared slot', () => {
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized' });
		const twine = makeObject('twine', { objectSizeType: 'smallSized' });

		expect(calculateInventorySlotCost([chalk, twine])).toBe(1);
	});

	it('throws for an unrecognised size type', () => {
		const broken = makeObject('broken', {
			objectSizeType: 'nonsense' as ContainableObject['system']['objectSizeType'],
		});

		expect(() => calculateInventorySlotCost([broken])).toThrow(/nonsense/);
	});
});

describe('calculateInventorySlotCost container rules', () => {
	it('charges a carried object its own slots when no container holds it', () => {
		expect(calculateInventorySlotCost([makeObject('sword', { slotsRequired: 2 })])).toBe(2);
	});

	it('leaves stored objects at full cost on the default normal slot cost', () => {
		const chest = makeContainer('chest');
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'chest' });

		expect(chest.system.container.slotCostMode).toBe('none');
		expect(calculateInventorySlotCost([chest, armor])).toBe(5);
	});

	it('keeps small objects in the shared slot on normal slot cost', () => {
		const chest = makeContainer('chest');
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'chest' });

		expect(calculateInventorySlotCost([chest, chalk])).toBe(2);
	});

	it('charges a bag of holding its own slot and nothing for what it holds', () => {
		const bagOfHolding = makeContainer('bag', { slotCostMode: 'ignore' });
		const plateArmor = makeObject('armor', { slotsRequired: 4, containerId: 'bag' });
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'bag' });

		expect(calculateInventorySlotCost([bagOfHolding, plateArmor, chalk])).toBe(1);
	});

	it('halves the cost of objects in a half-cost container', () => {
		const bag = makeContainer('bag', { slotCostMode: 'half' });
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag' });

		expect(calculateInventorySlotCost([bag, armor])).toBe(3);
	});

	it('subtracts the configured reduction from each object in the container', () => {
		const backpack = makeContainer('backpack', { slotCostMode: 'reduce', slotCostReduction: 1 });
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'backpack' });
		const sword = makeObject('sword', { slotsRequired: 2, containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, armor, sword])).toBe(5);
	});

	it('never reduces an object below no cost at all', () => {
		const backpack = makeContainer('backpack', { slotCostMode: 'reduce', slotCostReduction: 5 });
		const sword = makeObject('sword', { slotsRequired: 2, containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, sword])).toBe(1);
	});

	it('charges full cost while an equip-only container is stowed', () => {
		const backpack = makeContainer('backpack', {
			slotCostMode: 'ignore',
			requiresEquipped: true,
		});
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, armor])).toBe(5);
	});

	it('applies the rule once an equip-only container is equipped', () => {
		const backpack = makeContainer(
			'backpack',
			{ slotCostMode: 'ignore', requiresEquipped: true },
			{ equipped: true },
		);
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, armor])).toBe(1);
	});

	it('charges full cost when the container is no longer carried', () => {
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag-that-is-gone' });

		expect(calculateInventorySlotCost([armor])).toBe(4);
	});

	it('takes small objects out of the shared slot when their container ignores cost', () => {
		const bag = makeContainer('bag', { slotCostMode: 'ignore' });
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'bag' });

		expect(calculateInventorySlotCost([bag, chalk])).toBe(1);
	});

	it('keeps small objects in the shared slot when their container only reduces cost', () => {
		const backpack = makeContainer('backpack', { slotCostMode: 'reduce' });
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, chalk])).toBe(2);
	});

	it('keeps small objects in the shared slot when their container halves cost', () => {
		const backpack = makeContainer('backpack', { slotCostMode: 'half' });
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, chalk])).toBe(2);
	});

	it('rounds the total up once, so two half-cost objects share a slot', () => {
		const bag = makeContainer('bag', { slotCostMode: 'half' });
		const firstPotion = makeObject('potion-a', { slotsRequired: 1, containerId: 'bag' });
		const secondPotion = makeObject('potion-b', { slotsRequired: 1, containerId: 'bag' });

		expect(calculateInventorySlotCost([bag, firstPotion, secondPotion])).toBe(2);
	});
});

describe('getContainerUsedCapacity', () => {
	it('adds up the stored objects at their own slot cost', () => {
		const stored = [makeObject('sword', { slotsRequired: 2 }), makeObject('rope')];

		expect(getContainerUsedCapacity(stored)).toBe(3);
	});

	it('gives every small object stored inside one shared slot between them', () => {
		const stored = [
			makeObject('sword', { slotsRequired: 2 }),
			makeObject('coin', { objectSizeType: 'smallSized' }),
			makeObject('chalk', { objectSizeType: 'smallSized' }),
		];

		expect(getContainerUsedCapacity(stored)).toBe(3);
	});

	it('measures stored objects at full cost even when the container waives it', () => {
		const stored = [makeObject('armor', { slotsRequired: 4, containerId: 'bag' })];

		expect(getContainerUsedCapacity(stored)).toBe(4);
	});
});

describe('findContainerStorageRejection', () => {
	it('accepts an object a container has room and permission for', () => {
		expect(findContainerStorageRejection(makeContainer('bag'), makeObject('sword'), [])).toBeNull();
	});

	it('refuses an item that is not configured as a container', () => {
		expect(findContainerStorageRejection(makeObject('rock'), makeObject('sword'), [])).toBe(
			'notAContainer',
		);
	});

	it('refuses to nest one container inside another', () => {
		expect(findContainerStorageRejection(makeContainer('bag'), makeContainer('pouch'), [])).toBe(
			'nested',
		);
	});

	it('refuses an object type the container does not hold', () => {
		const quiver = makeContainer('quiver', { allowedObjectTypes: ['weapon'] });

		expect(findContainerStorageRejection(quiver, makeObject('potion'), [])).toBe('objectType');
	});

	it('accepts an allowed object type', () => {
		const quiver = makeContainer('quiver', { allowedObjectTypes: ['weapon'] });

		expect(
			findContainerStorageRejection(quiver, makeObject('bow', { objectType: 'weapon' }), []),
		).toBeNull();
	});

	it('refuses an object that would not fit in the remaining capacity', () => {
		const chest = makeContainer('chest', { capacity: 3 });
		const stored = [makeObject('armor', { slotsRequired: 3 })];

		expect(findContainerStorageRejection(chest, makeObject('sword'), stored)).toBe('capacity');
	});

	it('refuses a small object once the shared slot it needs would overflow', () => {
		const pouch = makeContainer('pouch', { capacity: 1 });
		const stored = [makeObject('sword', { slotsRequired: 1 })];
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized' });

		expect(findContainerStorageRejection(pouch, chalk, stored)).toBe('capacity');
	});

	it('fits any number of small objects into the one slot they share', () => {
		const pouch = makeContainer('pouch', { capacity: 1 });
		const stored = [
			makeObject('coin', { objectSizeType: 'smallSized' }),
			makeObject('twine', { objectSizeType: 'smallSized' }),
		];
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized' });

		expect(findContainerStorageRejection(pouch, chalk, stored)).toBeNull();
	});

	it('ignores capacity when the container has no limit', () => {
		const bag = makeContainer('bag');
		const stored = [makeObject('armor', { slotsRequired: 99 })];

		expect(findContainerStorageRejection(bag, makeObject('sword'), stored)).toBeNull();
	});

	it('does not count an object already stored against its own re-check', () => {
		const chest = makeContainer('chest', { capacity: 2 });
		const sword = makeObject('sword', { slotsRequired: 2, containerId: 'chest' });

		expect(findContainerStorageRejection(chest, sword, [sword])).toBeNull();
	});

	it('refuses a stored stack that grows past the capacity', () => {
		const quiver = makeContainer('quiver', { capacity: 1 });
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			quantity: 40,
			stackSize: 20,
			containerId: 'quiver',
		});

		expect(findContainerStorageRejection(quiver, arrows, [arrows])).toBe('capacity');
	});
});
