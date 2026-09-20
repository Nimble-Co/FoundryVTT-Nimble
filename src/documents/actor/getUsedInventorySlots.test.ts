import type { ContainableObject } from '#utils/inventoryContainers.js';
import { NimbleCharacter } from './character.js';

type ObjectStub = ContainableObject & { isType(type: string): boolean };

function makeObject(_id: string, system: Partial<ContainableObject['system']> = {}): ObjectStub {
	return {
		_id,
		name: _id,
		isType: (type: string) => type === 'object',
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

/** Only the fields `getUsedInventorySlots` reads off an actor. */
function makeStub(objects: ObjectStub[], includeCurrencyBulk = false, goldPieces = 0) {
	return {
		items: { forEach: (callback: (item: ObjectStub) => void) => objects.forEach(callback) },
		system: { currency: { gp: { value: goldPieces } } },
		getFlag: () => includeCurrencyBulk,
		getCarriedObjects: NimbleCharacter.prototype.getCarriedObjects,
	} as unknown as NimbleCharacter;
}

function countSlots(...args: Parameters<typeof makeStub>): number {
	return NimbleCharacter.prototype.getUsedInventorySlots.call(makeStub(...args));
}

describe('getUsedInventorySlots', () => {
	it('skips items that are not objects', () => {
		const feature = { isType: () => false } as unknown as ObjectStub;

		expect(countSlots([feature, makeObject('sword', { slotsRequired: 2 })])).toBe(2);
	});

	it('applies the rule of the container an object is stored in', () => {
		const bagOfHolding = makeObject('bag');
		bagOfHolding.system.container = { ...bagOfHolding.system.container, enabled: true };
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag' });

		expect(countSlots([bagOfHolding, armor])).toBe(1);
	});

	it('adds a slot per 500 coins on top of the objects carried', () => {
		expect(countSlots([makeObject('sword', { slotsRequired: 2 })], true, 1000)).toBe(4);
	});
});
