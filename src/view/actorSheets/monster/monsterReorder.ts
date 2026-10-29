import type { MonsterIntent, MonsterSortUpdate } from './monsterIntent.ts';

/** An entry of an ability group, in the order of the sheet, as a drag sees it. */
export interface ReorderEntry {
	id: string;
	/** the ability group: a drag moves an ability only inside its group */
	group: string;
	/** an attack sequence: actions nest under it */
	sequence: boolean;
	/** the attack sequence that holds the action; null for none */
	parentId: string | null;
}

/** Where a drop puts the dragged ability: a line above or below the target, or nested in a sequence. */
export interface DropPlace {
	position: 'above' | 'below' | 'nest';
	/** the attack sequence that holds the dragged action after the drop; null for none */
	parentId: string | null;
}

/**
 * Where a drop on `targetId` puts the dragged ability, or null when it cannot go there.
 * Loose actions show first, so a drop goes only where the ability then shows:
 * an attack sequence drops only on another one, and an action below a sequence nests in it.
 */
export function dropPlace(
	entries: ReorderEntry[],
	draggedId: string,
	targetId: string,
	above: boolean,
): DropPlace | null {
	const dragged = entries.find((entry) => entry.id === draggedId);
	const target = entries.find((entry) => entry.id === targetId);
	if (!dragged || !target || dragged.id === target.id || dragged.group !== target.group) {
		return null;
	}
	if (dragged.sequence) {
		return target.sequence ? { position: above ? 'above' : 'below', parentId: null } : null;
	}
	if (target.sequence) {
		if (!above) return { position: 'nest', parentId: target.id };
		// above a later sequence is the end of the sequence before it
		const before = entries
			.slice(0, entries.indexOf(target))
			.filter((entry) => entry.group === target.group && entry.sequence)
			.at(-1);
		return { position: 'above', parentId: before?.id ?? null };
	}
	return { position: above ? 'above' : 'below', parentId: target.parentId };
}

const SORT_STEP = 10000;

/** The new order of the group after the drop, as one update of each ability in it. */
export function reorderIntent(
	entries: ReorderEntry[],
	draggedId: string,
	targetId: string,
	place: DropPlace,
): MonsterIntent {
	const dragged = entries.find((entry) => entry.id === draggedId);
	const group = entries.filter((entry) => entry.group === dragged?.group && entry.id !== draggedId);
	const targetIndex = group.findIndex((entry) => entry.id === targetId);
	const order = [...group];
	if (dragged && targetIndex >= 0) {
		order.splice(place.position === 'above' ? targetIndex : targetIndex + 1, 0, dragged);
	}
	return {
		kind: 'reorder',
		updates: order.map((entry, index): MonsterSortUpdate => {
			const update: MonsterSortUpdate = { itemId: entry.id, sort: index * SORT_STEP };
			if (entry.id === draggedId && !entry.sequence) update.parentItemId = place.parentId;
			return update;
		}),
	};
}
