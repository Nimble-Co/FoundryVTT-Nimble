import type { MonsterAbilitiesTabProps } from '#types/components/actorSheets/MonsterAbilitiesTab.d.ts';
import { dragDataOf, mayDrag } from '../../shared/drag.ts';
import type { MonsterAbilityEntry } from '../monsterAbilitiesTab.ts';
import { type DropPlace, dropPlace, type ReorderEntry, reorderIntent } from '../monsterReorder.ts';

/**
 * The drag of the Abilities tab. A drag that starts here reorders the abilities: the target shows a
 * drop line, and the drop stops at the row, so it runs once. A drop from outside the sheet goes on
 * to the sheet, which creates the item.
 */
export function abilityDrag(props: () => MonsterAbilitiesTabProps) {
	let pointerType: string | null = null;
	let dragged: ReorderEntry | null = $state(null);
	let over: { id: string; place: DropPlace } | null = $state(null);

	const entries = $derived(
		props().view.groups.flatMap((group) => group.entries.map((entry) => entry.reorder)),
	);

	function placeAt(entry: MonsterAbilityEntry, event: DragEvent): DropPlace | null {
		if (!dragged) return null;
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		return dropPlace(entries, dragged.id, entry.id, event.clientY < box.top + box.height / 2);
	}

	function reset() {
		dragged = null;
		over = null;
	}

	return {
		/** the drop line on this entry while a drag is over it */
		lineOf(entry: MonsterAbilityEntry): DropPlace['position'] | null {
			return over?.id === entry.id ? over.place.position : null;
		},
		onpointerdown(event: PointerEvent) {
			pointerType = event.pointerType;
		},
		ondragstart(entry: MonsterAbilityEntry, event: DragEvent) {
			if (!entry.drag || !mayDrag(pointerType, props().ui.editing)) {
				event.preventDefault();
				return;
			}
			event.dataTransfer?.setData('text/plain', JSON.stringify(dragDataOf(entry.drag)));
			dragged = entry.reorder;
		},
		ondragover(entry: MonsterAbilityEntry, event: DragEvent) {
			if (!dragged) return;
			const place = placeAt(entry, event);
			over = place ? { id: entry.id, place } : null;
			if (place) event.preventDefault();
		},
		// crossing onto a child of the entry is not leaving it
		ondragleave(entry: MonsterAbilityEntry, event: DragEvent) {
			const to = event.relatedTarget;
			if (to instanceof Node && (event.currentTarget as Node).contains(to)) return;
			if (over?.id === entry.id) over = null;
		},
		ondragend: reset,
		ondrop(entry: MonsterAbilityEntry, event: DragEvent) {
			if (!dragged) return;
			event.preventDefault();
			event.stopPropagation();
			const draggedId = dragged.id;
			const place = over?.id === entry.id ? over.place : placeAt(entry, event);
			reset();
			if (place) void props().perform(reorderIntent(entries, draggedId, entry.id, place));
		},
	};
}
