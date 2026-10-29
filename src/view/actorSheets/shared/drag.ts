/** What a row gives when you drag it out of the sheet. The section makes the Foundry drag data. */
export type DragDescriptor =
	| { kind: 'item'; uuid: string }
	| { kind: 'heroicAction'; actionId: string; actionType: 'action' | 'reaction'; name: string };

/** A finger drags a row only in edit mode, so a scroll does not start a drag. */
export function mayDrag(pointerType: string | null, editing: boolean): boolean {
	return pointerType !== 'touch' || editing;
}

export function dragDataOf(drag: DragDescriptor): Record<string, string> {
	if (drag.kind === 'item') return { type: 'Item', uuid: drag.uuid };
	return {
		type: 'HeroicAction',
		actionId: drag.actionId,
		actionType: drag.actionType,
		name: drag.name,
	};
}

/** The drag data of a dropped Item, or null: a drop of anything else goes on to the sheet. */
export function droppedItemData(
	transfer: Pick<DataTransfer, 'getData'> | null | undefined,
): Record<string, unknown> | null {
	try {
		const data = JSON.parse(transfer?.getData('text/plain') ?? '') as unknown;
		if (typeof data !== 'object' || data === null) return null;
		return (data as { type?: unknown }).type === 'Item' ? (data as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}
