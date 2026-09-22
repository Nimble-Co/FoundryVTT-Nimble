import type { ContainableObject, ContainerConfig } from '../../types/inventoryContainers.js';

/**
 * A carried object shaped the way the container rules read it. The defaults
 * mirror `ObjectDataModel`, so a test that cares about a setting has to say so.
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
