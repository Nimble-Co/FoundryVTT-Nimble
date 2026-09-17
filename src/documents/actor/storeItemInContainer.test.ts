import { beforeEach, describe, expect, it, vi } from 'vitest';

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
				slotCostMode: 'none',
				slotCostReduction: 1,
				capacity: null,
				allowedObjectTypes: [],
				requiresEquipped: false,
			},
			...system,
		},
	};
}

function makeContainer(
	_id: string,
	container: Partial<ContainableObject['system']['container']> = {},
): ObjectStub {
	const object = makeObject(_id);
	object.system.container = { ...object.system.container, enabled: true, ...container };
	return object;
}

function makeActor(objects: ObjectStub[]) {
	const toggleEquipment = vi.fn(async () => {});
	const updateItem = vi.fn(async () => undefined);

	const actor = {
		items: {
			forEach: (callback: (item: ObjectStub) => void) => objects.forEach(callback),
			get: (id: string) =>
				objects.some(({ _id }) => _id === id) ? { toggleEquipment } : undefined,
		},
		updateItem,
		getCarriedObjects: NimbleCharacter.prototype.getCarriedObjects,
		getContainerContents: NimbleCharacter.prototype.getContainerContents,
	};

	return { actor: actor as unknown as NimbleCharacter, toggleEquipment, updateItem };
}

function store(actor: NimbleCharacter, itemId: string, containerId: string): Promise<boolean> {
	return NimbleCharacter.prototype.storeItemInContainer.call(actor, itemId, containerId);
}

const confirmDialog = vi.mocked(foundry.applications.api.DialogV2.confirm);

beforeEach(() => {
	confirmDialog.mockReset();
	vi.mocked(ui.notifications.warn).mockClear();
});

describe('storeItemInContainer', () => {
	it('stores an unequipped object without asking anything', async () => {
		const { actor, updateItem } = makeActor([makeContainer('bag'), makeObject('sword')]);

		expect(await store(actor, 'sword', 'bag')).toBe(true);
		expect(confirmDialog).not.toHaveBeenCalled();
		expect(updateItem).toHaveBeenCalledWith('sword', { 'system.containerId': 'bag' });
	});

	it('warns instead of storing when the container refuses the object', async () => {
		const quiver = makeContainer('quiver', { allowedObjectTypes: ['weapon'] });
		const { actor, updateItem } = makeActor([quiver, makeObject('potion')]);

		expect(await store(actor, 'potion', 'quiver')).toBe(false);
		expect(updateItem).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it('asks before stowing an equipped object, then unequips it', async () => {
		const { actor, toggleEquipment, updateItem } = makeActor([
			makeContainer('bag'),
			makeObject('sword', { equipped: true }),
		]);
		confirmDialog.mockResolvedValue(true);

		expect(await store(actor, 'sword', 'bag')).toBe(true);
		expect(confirmDialog).toHaveBeenCalled();
		expect(toggleEquipment).toHaveBeenCalled();
		expect(updateItem).toHaveBeenCalledWith('sword', { 'system.containerId': 'bag' });
	});

	it('leaves an equipped object equipped and out of the container when the prompt is declined', async () => {
		const { actor, toggleEquipment, updateItem } = makeActor([
			makeContainer('bag'),
			makeObject('sword', { equipped: true }),
		]);
		confirmDialog.mockResolvedValue(false);

		expect(await store(actor, 'sword', 'bag')).toBe(false);
		expect(toggleEquipment).not.toHaveBeenCalled();
		expect(updateItem).not.toHaveBeenCalled();
	});

	it('refuses to store a container inside itself', async () => {
		const { actor, updateItem } = makeActor([makeContainer('bag')]);

		expect(await store(actor, 'bag', 'bag')).toBe(false);
		expect(updateItem).not.toHaveBeenCalled();
	});
});
