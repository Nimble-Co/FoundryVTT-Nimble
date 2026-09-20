import {
	applyContainerSlotRule,
	type ContainableObject,
	type ContainerConfig,
	calculateInventorySlotCost,
	containerWaivesSmallObjectCost,
	findContainerStorageRejection,
	getBaseSlotCost,
	getContainerUsedCapacity,
} from './inventoryContainers.js';

function makeObject(
	_id: string,
	system: Partial<ContainableObject['system']> = {},
): ContainableObject {
	return {
		_id,
		name: _id,
		system: {
			objectType: 'misc',
			objectSizeType: 'slots',
			slotsRequired: 1,
			quantity: 1,
			stackSize: 2,
			equipped: false,
			containerId: '',
			container: {
				enabled: false,
				slotCostMode: 'ignore',
				slotCostReduction: 1,
				capacity: null,
				allowedObjectTypes: [],
				requiresEquipped: false,
			},
			...system,
		},
	};
}

function makeContainer(_id: string, container: Partial<ContainerConfig> = {}): ContainableObject {
	const object = makeObject(_id);
	object.system.container = { ...object.system.container, enabled: true, ...container };
	return object;
}

describe('getBaseSlotCost', () => {
	it('uses the stored slot count for slot-sized objects', () => {
		expect(getBaseSlotCost(makeObject('sword', { slotsRequired: 2 }))).toBe(2);
	});

	it('charges one slot per started stack for stackable objects', () => {
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			quantity: 25,
			stackSize: 20,
		});

		expect(getBaseSlotCost(arrows)).toBe(2);
	});

	it('reports no individual cost for small objects', () => {
		expect(getBaseSlotCost(makeObject('coin', { objectSizeType: 'smallSized' }))).toBeNull();
	});

	it('throws for an unrecognised size type', () => {
		const broken = makeObject('broken', {
			objectSizeType: 'nonsense' as ContainableObject['system']['objectSizeType'],
		});

		expect(() => getBaseSlotCost(broken)).toThrow(/nonsense/);
	});
});

describe('applyContainerSlotRule', () => {
	it('drops the cost to nothing when the container ignores slot cost', () => {
		expect(applyContainerSlotRule(makeContainer('bag'), 3)).toBe(0);
	});

	it('halves the cost when the container halves slot cost', () => {
		expect(applyContainerSlotRule(makeContainer('bag', { slotCostMode: 'half' }), 3)).toBe(1.5);
	});

	it('subtracts the configured amount when the container reduces slot cost', () => {
		const bag = makeContainer('bag', { slotCostMode: 'reduce', slotCostReduction: 1 });

		expect(applyContainerSlotRule(bag, 3)).toBe(2);
	});

	it('never reduces a cost below zero', () => {
		const bag = makeContainer('bag', { slotCostMode: 'reduce', slotCostReduction: 5 });

		expect(applyContainerSlotRule(bag, 2)).toBe(0);
	});

	it('leaves the cost alone when the item is not configured as a container', () => {
		expect(applyContainerSlotRule(makeObject('crate'), 3)).toBe(3);
	});

	it('leaves the cost alone while an equip-only container is stowed', () => {
		const backpack = makeContainer('backpack', { requiresEquipped: true });

		expect(applyContainerSlotRule(backpack, 3)).toBe(3);
	});

	it('applies the rule once an equip-only container is equipped', () => {
		const backpack = makeContainer('backpack', { requiresEquipped: true });
		backpack.system.equipped = true;

		expect(applyContainerSlotRule(backpack, 3)).toBe(0);
	});
});

describe('containerWaivesSmallObjectCost', () => {
	it('waives the shared small-object slot only when the container ignores cost', () => {
		expect(containerWaivesSmallObjectCost(makeContainer('bag'))).toBe(true);
		expect(containerWaivesSmallObjectCost(makeContainer('bag', { slotCostMode: 'half' }))).toBe(
			false,
		);
		expect(containerWaivesSmallObjectCost(makeContainer('bag', { slotCostMode: 'reduce' }))).toBe(
			false,
		);
	});
});

describe('getContainerUsedCapacity', () => {
	it('adds up the stored objects at their own slot cost, small objects counting for nothing', () => {
		const stored = [
			makeObject('sword', { slotsRequired: 2 }),
			makeObject('coin', { objectSizeType: 'smallSized' }),
		];

		expect(getContainerUsedCapacity(stored)).toBe(2);
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
});

describe('calculateInventorySlotCost', () => {
	it('charges a carried object its own slots when no container holds it', () => {
		expect(calculateInventorySlotCost([makeObject('sword', { slotsRequired: 2 })])).toBe(2);
	});

	it('still charges the container itself while waiving what it holds', () => {
		const bagOfHolding = makeContainer('bag');
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag' });

		expect(calculateInventorySlotCost([bagOfHolding, armor])).toBe(1);
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

	it('charges full cost while an equip-only container is stowed', () => {
		const backpack = makeContainer('backpack', { requiresEquipped: true });
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, armor])).toBe(5);
	});

	it('charges full cost when the container is no longer carried', () => {
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag-that-is-gone' });

		expect(calculateInventorySlotCost([armor])).toBe(4);
	});

	it('takes small objects out of the shared slot when their container ignores cost', () => {
		const bag = makeContainer('bag');
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'bag' });

		expect(calculateInventorySlotCost([bag, chalk])).toBe(1);
	});

	it('keeps small objects in the shared slot when their container only reduces cost', () => {
		const backpack = makeContainer('backpack', { slotCostMode: 'reduce' });
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'backpack' });

		expect(calculateInventorySlotCost([backpack, chalk])).toBe(2);
	});

	it('rounds the total up once, so two half-cost objects share a slot', () => {
		const bag = makeContainer('bag', { slotCostMode: 'half' });
		const firstPotion = makeObject('potion-a', { slotsRequired: 1, containerId: 'bag' });
		const secondPotion = makeObject('potion-b', { slotsRequired: 1, containerId: 'bag' });

		expect(calculateInventorySlotCost([bag, firstPotion, secondPotion])).toBe(2);
	});

	it('charges every small object carried loose a single shared slot', () => {
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized' });
		const twine = makeObject('twine', { objectSizeType: 'smallSized' });

		expect(calculateInventorySlotCost([chalk, twine])).toBe(1);
	});
});
