import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createCarriedContainer as makeContainer,
	createCarriedObject as makeObject,
	type ContainableObjectStub as ObjectStub,
} from '../../../tests/fixtures/containableObject.js';
import { NimbleCharacter } from './character.js';

function makeActor(objects: ObjectStub[]) {
	const withAllRulesDisabled = vi.fn(() => [{ type: 'armorClass', disabled: true }]);
	const updateItem = vi.fn(async () => undefined);

	const actor = {
		items: {
			forEach: (callback: (item: ObjectStub) => void) => objects.forEach(callback),
			get: (id: string) =>
				objects.some(({ _id }) => _id === id) ? { rules: { withAllRulesDisabled } } : undefined,
		},
		updateItem,
		getCarriedObjects: NimbleCharacter.prototype.getCarriedObjects,
		getContainerContents: NimbleCharacter.prototype.getContainerContents,
		canStoreObjectInContainer: NimbleCharacter.prototype.canStoreObjectInContainer,
		canStoreDroppedObjectInContainer: NimbleCharacter.prototype.canStoreDroppedObjectInContainer,
	};

	return { actor: actor as unknown as NimbleCharacter, withAllRulesDisabled, updateItem };
}

function store(actor: NimbleCharacter, itemId: string, containerId: string): Promise<boolean> {
	return NimbleCharacter.prototype.storeItemInContainer.call(actor, itemId, containerId);
}

function removeFromContainer(actor: NimbleCharacter, itemId: string): Promise<void> {
	return NimbleCharacter.prototype.removeItemFromContainer.call(actor, itemId);
}

function setQuantity(actor: NimbleCharacter, itemId: string, quantity: number): Promise<boolean> {
	return NimbleCharacter.prototype.updateStoredObjectQuantity.call(actor, itemId, quantity);
}

const confirmDialog = vi.mocked(foundry.applications.api.DialogV2.confirm);
const warn = vi.mocked(ui.notifications.warn);

beforeEach(() => {
	confirmDialog.mockReset();
	warn.mockClear();
});

describe('storeItemInContainer', () => {
	it('stores an unequipped object without asking anything', async () => {
		const { actor, updateItem } = makeActor([makeContainer('bag'), makeObject('sword')]);

		expect(await store(actor, 'sword', 'bag')).toBe(true);
		expect(confirmDialog).not.toHaveBeenCalled();
		expect(updateItem).toHaveBeenCalledWith('sword', { 'system.containerId': 'bag' });
	});

	it('names the object type as the reason a quiver refuses a potion', async () => {
		const quiver = makeContainer('quiver', { allowedObjectTypes: ['weapon'] });
		const { actor, updateItem } = makeActor([quiver, makeObject('potion')]);

		expect(await store(actor, 'potion', 'quiver')).toBe(false);
		expect(updateItem).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith('quiver does not hold objects of that type.');
	});

	it('names capacity as the reason a full chest refuses an object', async () => {
		const chest = makeContainer('chest', { capacity: 2 });
		const stored = makeObject('armor', { slotsRequired: 2, containerId: 'chest' });
		const { actor } = makeActor([chest, stored, makeObject('sword')]);

		expect(await store(actor, 'sword', 'chest')).toBe(false);
		expect(warn).toHaveBeenCalledWith('chest has no room left for sword.');
	});

	it('asks before stowing an equipped object, then unequips it in the same write', async () => {
		const { actor, withAllRulesDisabled, updateItem } = makeActor([
			makeContainer('bag'),
			makeObject('sword', { equipped: true }),
		]);
		confirmDialog.mockResolvedValue(true);

		expect(await store(actor, 'sword', 'bag')).toBe(true);
		expect(confirmDialog).toHaveBeenCalled();
		expect(withAllRulesDisabled).toHaveBeenCalledWith(true);
		expect(updateItem).toHaveBeenCalledTimes(1);
		expect(updateItem).toHaveBeenCalledWith('sword', {
			'system.containerId': 'bag',
			'system.equipped': false,
			'system.rules': [{ type: 'armorClass', disabled: true }],
		});
	});

	it('leaves an equipped object equipped and out of the container when the prompt is declined', async () => {
		const { actor, updateItem } = makeActor([
			makeContainer('bag'),
			makeObject('sword', { equipped: true }),
		]);
		confirmDialog.mockResolvedValue(false);

		expect(await store(actor, 'sword', 'bag')).toBe(false);
		expect(updateItem).not.toHaveBeenCalled();
	});

	it('refuses to store a container inside itself', async () => {
		const { actor, updateItem } = makeActor([makeContainer('bag')]);

		expect(await store(actor, 'bag', 'bag')).toBe(false);
		expect(updateItem).not.toHaveBeenCalled();
	});
});

describe('canStoreDroppedObjectInContainer', () => {
	/** A fresh drop of the same thing: the same name, but not the document already stored. */
	function droppedCopyOf(stored: ObjectStub): ObjectStub {
		const dropped = makeObject('dropped', {
			objectSizeType: stored.system.objectSizeType,
			stackSize: stored.system.stackSize,
		});
		dropped.name = stored.name;

		return dropped;
	}

	function canStore(actor: NimbleCharacter, containerId: string, dropped: ObjectStub): boolean {
		return NimbleCharacter.prototype.canStoreDroppedObjectInContainer.call(
			actor,
			containerId,
			dropped,
		);
	}

	it('measures a drop that folds into a stored stack as that stack grown by one', () => {
		const quiver = makeContainer('quiver', { capacity: 1 });
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			stackSize: 20,
			quantity: 5,
			containerId: 'quiver',
		});
		const { actor } = makeActor([quiver, arrows]);

		expect(canStore(actor, 'quiver', droppedCopyOf(arrows))).toBe(true);
	});

	it('refuses a drop that would start the stack a second slot past the capacity', () => {
		const quiver = makeContainer('quiver', { capacity: 1 });
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			stackSize: 20,
			quantity: 20,
			containerId: 'quiver',
		});
		const { actor } = makeActor([quiver, arrows]);

		expect(canStore(actor, 'quiver', droppedCopyOf(arrows))).toBe(false);
	});

	it('measures a drop that matches nothing stored as its own object', () => {
		const chest = makeContainer('chest', { capacity: 2 });
		const { actor } = makeActor([chest]);
		const dropped = makeObject('armor', { slotsRequired: 4 });

		expect(canStore(actor, 'chest', dropped)).toBe(false);
	});

	it('does not merge a slot-sized object into a same-named stack', () => {
		const chest = makeContainer('chest', { capacity: 1 });
		const rope = makeObject('rope', { objectSizeType: 'stackable', containerId: 'chest' });
		const { actor } = makeActor([chest, rope]);
		const dropped = makeObject('dropped-rope', { slotsRequired: 1 });
		dropped.name = rope.name;

		expect(canStore(actor, 'chest', dropped)).toBe(false);
	});
});

describe('removeItemFromContainer', () => {
	it('clears the container the object was stored in', async () => {
		const { actor, updateItem } = makeActor([
			makeContainer('bag'),
			makeObject('sword', { containerId: 'bag' }),
		]);

		await removeFromContainer(actor, 'sword');

		expect(updateItem).toHaveBeenCalledWith('sword', { 'system.containerId': '' });
	});
});

describe('updateStoredObjectQuantity', () => {
	it('writes the new quantity for an object carried loose', async () => {
		const arrows = makeObject('arrows', { objectSizeType: 'stackable', quantity: 20 });
		const { actor, updateItem } = makeActor([arrows]);

		expect(await setQuantity(actor, 'arrows', 60)).toBe(true);
		expect(updateItem).toHaveBeenCalledWith('arrows', { 'system.quantity': 60 });
	});

	it('writes a quantity that still fits the container holding it', async () => {
		const quiver = makeContainer('quiver', { capacity: 3 });
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			quantity: 20,
			stackSize: 20,
			containerId: 'quiver',
		});
		const { actor, updateItem } = makeActor([quiver, arrows]);

		expect(await setQuantity(actor, 'arrows', 40)).toBe(true);
		expect(updateItem).toHaveBeenCalledWith('arrows', { 'system.quantity': 40 });
	});

	it('refuses a quantity that would overflow the container holding it', async () => {
		const quiver = makeContainer('quiver', { capacity: 2 });
		const arrows = makeObject('arrows', {
			objectSizeType: 'stackable',
			quantity: 20,
			stackSize: 20,
			containerId: 'quiver',
		});
		const { actor, updateItem } = makeActor([quiver, arrows]);

		expect(await setQuantity(actor, 'arrows', 100)).toBe(false);
		expect(updateItem).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith('quiver has no room for that many of arrows.');
	});
});
