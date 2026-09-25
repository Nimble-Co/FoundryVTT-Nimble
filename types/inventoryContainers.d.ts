/** How a container changes what the objects inside it cost their carrier. */
export type ContainerSlotCostMode = 'none' | 'ignore' | 'reduce' | 'half';

/** How an object occupies inventory space. */
export type ObjectSizeType = 'slots' | 'stackable' | 'smallSized';

export interface ContainerConfig {
	enabled: boolean;
	slotCostMode: ContainerSlotCostMode;
	slotCostReduction: number;
	capacity: number | null;
	allowedObjectTypes: string[];
	requiresEquipped: boolean;
}

/** The parts of an object item that the container rules read. */
export interface ContainableObject {
	_id: string;
	name: string;
	system: {
		objectType: string;
		objectSizeType: ObjectSizeType;
		slotsRequired: number;
		stowedSlotsRequired: number | null;
		quantity: number;
		stackSize: number;
		equipped: boolean;
		containerId: string;
		container: ContainerConfig;
	};
}

export type ContainerStorageRejection = 'notAContainer' | 'nested' | 'objectType' | 'capacity';
