import type { ContainerSlotCostMode, ObjectSizeType } from '#types/inventoryContainers.js';

/** The slot cost modes a container can be set to, in the order the sheet offers them. */
export const CONTAINER_SLOT_COST_MODES: readonly ContainerSlotCostMode[] = [
	'none',
	'ignore',
	'reduce',
	'half',
];

/** The ways an object can occupy inventory space. */
export const OBJECT_SIZE_TYPES: readonly ObjectSizeType[] = ['slots', 'stackable', 'smallSized'];
