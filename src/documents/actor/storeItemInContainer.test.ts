import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContainableObject, ContainerConfig } from '#types/inventoryContainers.js';
import {
	createContainableObject,
	createContainer,
} from '../../../tests/fixtures/containableObject.js';
import { NimbleCharacter } from './character.js';

type ObjectStub = ContainableObject & { isType(type: string): boolean };

function asStub(object: ContainableObject): ObjectStub {
	return { ...object, isType: (type: string) => type === 'object' };
}

function makeObject(_id: string, system: Partial<ContainableObject['system']> = {}): ObjectStub {
	return asStub(createContainableObject(_id, system));
}

function makeContainer(_id: string, container: Partial<ContainerConfig> = {}): ObjectStub {
	return asStub(createContainer(_id, container));
}

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
