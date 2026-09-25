import type { ContainableObject, ContainerConfig } from '../../types/inventoryContainers.js';

/**
 * A carried object shaped the way the container rules read it: a one-slot piece
 * of gear in no container. A test that cares about any other setting says so.
 */
export function createContainableObject(
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

/** The same object with its container switched on. */
export function createContainer(
	_id: string,
	container: Partial<ContainerConfig> = {},
	system: Partial<ContainableObject['system']> = {},
): ContainableObject {
	const object = createContainableObject(_id, system);
	object.system.container = { ...object.system.container, enabled: true, ...container };
	return object;
}

/** The parts of an object item the actor reads when it sweeps its own collection. */
export type ContainableObjectStub = ContainableObject & { isType(type: string): boolean };

/** The same object as the actor's item collection hands it back. */
export function asCarriedItem(object: ContainableObject): ContainableObjectStub {
	return { ...object, isType: (type: string) => type === 'object' };
}

/** A carried object built and stubbed in one step. */
export function createCarriedObject(
	_id: string,
	system: Partial<ContainableObject['system']> = {},
): ContainableObjectStub {
	return asCarriedItem(createContainableObject(_id, system));
}

/** A carried container built and stubbed in one step. */
export function createCarriedContainer(
	_id: string,
	container: Partial<ContainerConfig> = {},
	system: Partial<ContainableObject['system']> = {},
): ContainableObjectStub {
	return asCarriedItem(createContainer(_id, container, system));
}
