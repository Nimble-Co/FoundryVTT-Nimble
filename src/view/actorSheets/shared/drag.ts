/** What a row gives when you drag it out of the sheet. The section makes the Foundry drag data. */
export type DragDescriptor =
	| { kind: 'item'; uuid: string }
	| { kind: 'heroicAction'; actionId: string; actionType: 'action' | 'reaction'; name: string };

/** Spec 5.8: a finger drags a row only in edit mode, so a scroll does not start a drag. */
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
