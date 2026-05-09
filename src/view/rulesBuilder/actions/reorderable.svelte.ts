/**
 * Svelte action for cross-list HTML5 drag/drop copy. Apply to a list
 * container; each child must carry a `data-reorder-id` attribute and be
 * `draggable`.
 *
 * On drag from a list, encodes a JSON payload onto `dataTransfer` (built
 * by the consumer's `getDragPayload`). On drop onto a different list with
 * the matching `copyAcceptType`, calls the consumer's `onCopy(payload)`.
 *
 * Within-list drops are no-ops — application order is determined by the
 * `priority` field on each rule, not by array order, so reordering by
 * drag would be misleading. Use the inline priority input on each card
 * to change application order.
 */

interface ReorderableOptions {
	/** Apply or remove the action. Allows toggling without re-mounting the list. */
	enabled: boolean;
	/**
	 * Build a JSON payload to attach to `dataTransfer` at dragstart. Returning
	 * `null`/`undefined` means "no cross-list payload"; the drag still happens
	 * for browser visual feedback but receivers won't accept it.
	 */
	getDragPayload?: (id: string) => Record<string, unknown> | null | undefined;
	/**
	 * Called when a payload from another reorderable list is dropped onto
	 * this one. Receives the parsed payload.
	 */
	onCopy?: (payload: Record<string, unknown>) => void;
	/**
	 * The `type` value that `onCopy` will accept. Drops with any other type
	 * are ignored. Defaults to `'reorderable'`.
	 */
	copyAcceptType?: string;
}

interface ReorderableActionReturn {
	update(options: ReorderableOptions): void;
	destroy(): void;
}

const ITEM_ATTR = 'data-reorder-id';
const DRAGGING_CLASS = 'nimble-reorderable--dragging';
const SOURCE_HIDDEN_CLASS = 'nimble-reorderable__item--source-hidden';
const FOREIGN_DRAG_CLASS = 'nimble-reorderable--foreign-drag';

function findItemElement(target: EventTarget | null, container: HTMLElement): HTMLElement | null {
	if (!(target instanceof Element)) return null;
	const item = target.closest<HTMLElement>(`[${ITEM_ATTR}]`);
	if (!item || !container.contains(item)) return null;
	return item;
}

export function reorderable(
	node: HTMLElement,
	options: ReorderableOptions,
): ReorderableActionReturn {
	let enabled = options.enabled;
	let getDragPayload = options.getDragPayload;
	let onCopy = options.onCopy;
	let copyAcceptType = options.copyAcceptType ?? 'reorderable';
	let draggedItem: HTMLElement | null = null;

	function clearDragVisuals() {
		if (draggedItem) {
			draggedItem.classList.remove(SOURCE_HIDDEN_CLASS);
		}
		node.classList.remove(DRAGGING_CLASS);
		node.classList.remove(FOREIGN_DRAG_CLASS);
		draggedItem = null;
		window.removeEventListener('dragend', cleanupHandler);
		window.removeEventListener('drop', cleanupHandler);
		window.removeEventListener('blur', cleanupHandler);
	}

	const cleanupHandler = () => {
		clearDragVisuals();
	};

	function onDragStart(event: DragEvent) {
		if (!enabled) return;
		const target = event.target;
		if (!(target instanceof Element)) return;

		const item = findItemElement(target, node);
		if (!item) return;
		const id = item.dataset.reorderId;
		if (!id) return;

		draggedItem = item;

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'copy';
			const payload = getDragPayload?.(id);
			if (payload && copyAcceptType) {
				const wrapped = { ...payload, type: copyAcceptType };
				event.dataTransfer.setData('text/plain', JSON.stringify(wrapped));
			} else {
				event.dataTransfer.setData('text/plain', id);
			}
		}

		node.classList.add(DRAGGING_CLASS);
		// Defer hiding the source until the drag visibly starts to avoid the
		// awkward flash where the item disappears before the drag image is set.
		requestAnimationFrame(() => {
			draggedItem?.classList.add(SOURCE_HIDDEN_CLASS);
		});

		window.addEventListener('dragend', cleanupHandler);
		window.addEventListener('drop', cleanupHandler);
		window.addEventListener('blur', cleanupHandler);
	}

	function isForeignDrag(event: DragEvent): boolean {
		// `dataTransfer` payload isn't readable mid-drag (browser security);
		// the absence of a local `draggedItem` is the signal.
		if (draggedItem) return false;
		if (!onCopy) return false;
		return event.dataTransfer?.types.includes('text/plain') === true;
	}

	function onDragOver(event: DragEvent) {
		if (!enabled) return;
		if (!isForeignDrag(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		node.classList.add(FOREIGN_DRAG_CLASS);
	}

	function onDragLeave(event: DragEvent) {
		if (event.target !== node) return;
		node.classList.remove(FOREIGN_DRAG_CLASS);
	}

	function onDrop(event: DragEvent) {
		if (!enabled) return;
		if (draggedItem) return; // within-list drops are no-ops
		if (!onCopy) return;

		const raw = event.dataTransfer?.getData('text/plain');
		if (!raw) return;
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return;
		}
		if (parsed.type !== copyAcceptType) return;

		event.preventDefault();
		node.classList.remove(FOREIGN_DRAG_CLASS);
		onCopy(parsed);
	}

	node.addEventListener('dragstart', onDragStart);
	node.addEventListener('dragover', onDragOver);
	node.addEventListener('drop', onDrop);
	node.addEventListener('dragleave', onDragLeave);

	return {
		update(next: ReorderableOptions) {
			enabled = next.enabled;
			getDragPayload = next.getDragPayload;
			onCopy = next.onCopy;
			copyAcceptType = next.copyAcceptType ?? 'reorderable';
			if (!enabled) clearDragVisuals();
		},
		destroy() {
			clearDragVisuals();
			node.removeEventListener('dragstart', onDragStart);
			node.removeEventListener('dragover', onDragOver);
			node.removeEventListener('drop', onDrop);
			node.removeEventListener('dragleave', onDragLeave);
		},
	};
}
