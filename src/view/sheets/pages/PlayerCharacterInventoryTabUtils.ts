import type { ContainerConfig } from '#types/inventoryContainers.js';

/** The prepared view of an inventory row that the tab's grouping and drop rules read. */
export type InventoryRowItem = {
	_id: string;
	reactive: {
		_id: string;
		name?: string;
		system: {
			objectType: string;
			containerId?: string;
			rules?: unknown[];
			container?: Partial<ContainerConfig>;
		};
	};
};

export function isDropDataRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isContainer(item: InventoryRowItem | undefined | null): boolean {
	return item?.reactive?.system?.container?.enabled ?? false;
}

/**
 * Where an item dropped onto this row belongs: the row's own id when the row is
 * a container, otherwise whatever holds the row. Dropping onto a row inside a
 * bag puts the item in that bag, and dropping onto a row carried directly takes
 * it out of wherever it was.
 */
export function getDropTargetContainerId(item: InventoryRowItem): string {
	if (isContainer(item)) return item.reactive._id;

	return item.reactive.system.containerId ?? '';
}

/**
 * A stored object is packed away, so it can never be equipped. Otherwise the
 * toggle belongs to items whose rules it switches, plus containers that only
 * apply their rule while equipped: those usually carry no rules of their own,
 * and without the toggle their setting could never be satisfied.
 */
export function canToggleEquipment(item: InventoryRowItem): boolean {
	if (item.reactive.system.containerId) return false;
	if ((item.reactive.system.rules?.length ?? 0) > 0) return true;

	return isContainer(item) && Boolean(item.reactive.system.container?.requiresEquipped);
}

/** The rows each container holds, keyed by container id. */
export function groupItemsByContainer<T extends InventoryRowItem>(items: T[]): Record<string, T[]> {
	return items.reduce<Record<string, T[]>>((contents, item) => {
		const { containerId } = item.reactive.system;
		if (!containerId) return contents;

		contents[containerId] ??= [];
		contents[containerId].push(item);

		return contents;
	}, {});
}

/** The rows under each object type heading. */
export function groupItemsByType<T extends InventoryRowItem>(items: T[]): Record<string, T[]> {
	return items.reduce<Record<string, T[]>>((categories, item) => {
		const { objectType } = item.reactive.system;

		categories[objectType] ??= [];
		categories[objectType].push(item);

		return categories;
	}, {});
}

/** A container this row's item could be moved into, named for a picker. */
export type ContainerChoice = { _id: string; name: string };

/**
 * The containers an item may be moved into: every container carried except the
 * one already holding it, and none at all for a container, which cannot nest.
 */
export function getContainerChoices<T extends InventoryRowItem & { reactive: { name: string } }>(
	items: T[],
	movedItem: InventoryRowItem,
): ContainerChoice[] {
	if (isContainer(movedItem)) return [];

	const holdingId = movedItem.reactive.system.containerId ?? '';

	return items
		.filter(
			(item) =>
				isContainer(item) &&
				item.reactive._id !== holdingId &&
				item.reactive._id !== movedItem.reactive._id,
		)
		.map((item) => ({ _id: item.reactive._id, name: item.reactive.name }));
}
