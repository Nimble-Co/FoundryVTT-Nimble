export type ContainerSlotCostMode = 'none' | 'ignore' | 'reduce' | 'half';

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
		objectSizeType: string;
		slotsRequired: number;
		quantity: number;
		stackSize: number;
		equipped: boolean;
		containerId: string;
		container: ContainerConfig;
	};
}

export type ContainerStorageRejection = 'notAContainer' | 'nested' | 'objectType' | 'capacity';

/**
 * Slots the object occupies before any container changes them. `null` for small
 * objects, which share a single slot across the whole inventory rather than
 * costing anything individually.
 */
export function getBaseSlotCost(object: ContainableObject): number | null {
	switch (object.system.objectSizeType) {
		case 'slots':
			return object.system.slotsRequired;
		case 'stackable':
			return Math.ceil(object.system.quantity / object.system.stackSize);
		case 'smallSized':
			return null;
		default:
			console.warn(
				"Nimble | Can't calculate slots used for object size type",
				object.system.objectSizeType,
			);
			return 0;
	}
}

/**
 * Whether the container's rule is currently changing what its contents cost. A
 * container set to apply only while equipped holds its contents at full cost
 * while it is stowed.
 */
function isContainerRuleActive(container: ContainableObject): boolean {
	const { enabled, requiresEquipped } = container.system.container;

	if (!enabled) return false;

	return !requiresEquipped || container.system.equipped;
}

/** The slots a stored object costs its carrier once the container's rule applies. */
export function applyContainerSlotRule(container: ContainableObject, baseSlotCost: number): number {
	if (!isContainerRuleActive(container)) return baseSlotCost;

	const { slotCostMode, slotCostReduction } = container.system.container;

	switch (slotCostMode) {
		case 'none':
			return baseSlotCost;
		case 'ignore':
			return 0;
		case 'half':
			return baseSlotCost / 2;
		case 'reduce':
			return Math.max(0, baseSlotCost - slotCostReduction);
		default:
			return baseSlotCost;
	}
}

/**
 * Whether the container removes the cost of small objects stored in it. Small
 * objects have no individual slot cost to reduce or halve, so only a container
 * that ignores cost outright takes them out of the shared small-object slot.
 */
export function containerWaivesSmallObjectCost(container: ContainableObject): boolean {
	return isContainerRuleActive(container) && container.system.container.slotCostMode === 'ignore';
}

/**
 * Slots a set of carried objects costs, with each container's rule applied to
 * what it holds. Small objects have no cost of their own and share a single
 * slot between them, which is added after the rest is rounded up so that two
 * half-slot potions still share one slot.
 *
 * An object whose container is not in the set is carried loose and pays in full.
 */
export function calculateInventorySlotCost(objects: ContainableObject[]): number {
	const objectsById = new Map(objects.map((object) => [object._id, object]));
	let slotCost = 0;
	let carriesSmallObjects = false;

	for (const object of objects) {
		const container = objectsById.get(object.system.containerId) ?? null;
		const baseSlotCost = getBaseSlotCost(object);

		if (baseSlotCost === null) {
			if (container && containerWaivesSmallObjectCost(container)) continue;
			carriesSmallObjects = true;
			continue;
		}

		slotCost += container ? applyContainerSlotRule(container, baseSlotCost) : baseSlotCost;
	}

	return Math.ceil(slotCost) + (carriesSmallObjects ? 1 : 0);
}

/** Slots the stored objects take up against the container's own capacity. */
export function getContainerUsedCapacity(storedObjects: ContainableObject[]): number {
	return storedObjects.reduce((total, object) => total + (getBaseSlotCost(object) ?? 0), 0);
}

/**
 * Why the container will not take the object, or `null` when it will. Capacity is
 * measured in the objects' own slot costs: a container changes what its contents
 * cost the carrier, not how much room they take up inside it.
 */
export function findContainerStorageRejection(
	container: ContainableObject,
	object: ContainableObject,
	storedObjects: ContainableObject[],
): ContainerStorageRejection | null {
	const { enabled, allowedObjectTypes, capacity } = container.system.container;

	if (!enabled) return 'notAContainer';
	if (object.system.container.enabled) return 'nested';

	if (allowedObjectTypes.length > 0 && !allowedObjectTypes.includes(object.system.objectType)) {
		return 'objectType';
	}

	if (capacity === null) return null;

	const remaining = storedObjects.filter((stored) => stored._id !== object._id);
	if (getContainerUsedCapacity(remaining) + (getBaseSlotCost(object) ?? 0) > capacity) {
		return 'capacity';
	}

	return null;
}
