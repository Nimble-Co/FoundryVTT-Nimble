import type { HeroTabId } from './heroFrame.ts';

/** What the Application needs to know about a carried item to place a drop. */
export interface DropTarget {
	id: string;
	uuid: string;
	type: string;
	containerId: string;
}

export type DropAction =
	/** a new item: through the shared drop route, into this container (empty = loose) */
	| { kind: 'create'; containerId: string }
	| { kind: 'store'; itemId: string; containerId: string }
	| { kind: 'takeOut'; itemId: string }
	/** a carried item dropped outside the Inventory, or one that is not an object: show its row */
	| { kind: 'reveal'; itemId: string; itemType: string }
	| { kind: 'none' };

/**
 * Where an Item drop goes. `containerId` is the place on the Inventory (a container id, or
 * empty for loose); null is a drop anywhere else on the sheet.
 */
export function dropAction(
	carried: DropTarget[],
	data: Record<string, unknown>,
	containerId: string | null,
): DropAction {
	const item = carried.find((entry) => entry.uuid === data.uuid);
	if (!item) return { kind: 'create', containerId: containerId ?? '' };
	if (containerId === null || item.type !== 'object') {
		return { kind: 'reveal', itemId: item.id, itemType: item.type };
	}
	if (item.id === containerId || item.containerId === containerId) return { kind: 'none' };
	return containerId
		? { kind: 'store', itemId: item.id, containerId }
		: { kind: 'takeOut', itemId: item.id };
}

export function tabOfItemType(type: unknown): HeroTabId {
	if (type === 'object') return 'inventory';
	if (type === 'spell') return 'spells';
	return 'features';
}
