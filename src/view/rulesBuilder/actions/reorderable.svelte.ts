/**
 * Svelte action for native HTML5 list reorder. Apply to a list container;
 * each child must carry a `data-reorder-id` attribute. On drop, calls
 * `onReorder` with the new id order — the consumer typically routes that
 * straight into `RulesManager.reorderRules` or equivalent.
 *
 * Optional drag handles: any descendant carrying `data-reorder-handle`
 * becomes the only valid drag origin. If no handle elements are present,
 * the whole item is draggable.
 */

interface ReorderableOptions {
	/** Apply or remove the action. Allows toggling without re-mounting the list. */
	enabled: boolean;
	/** Called with the new id order after a successful drop. */
	onReorder: (ids: string[]) => void;
}

interface ReorderableActionReturn {
	update(options: ReorderableOptions): void;
	destroy(): void;
}

const ITEM_ATTR = 'data-reorder-id';
const DRAG_HANDLE_ATTR = 'data-reorder-handle';
const DRAGGING_CLASS = 'nimble-reorderable--dragging';
const SOURCE_HIDDEN_CLASS = 'nimble-reorderable__item--source-hidden';
const PLACEHOLDER_CLASS = 'nimble-reorderable__placeholder';

function readIds(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`))
		.map((el) => el.dataset.reorderId)
		.filter((id): id is string => Boolean(id));
}

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
	let onReorder = options.onReorder;
	let draggedItem: HTMLElement | null = null;
	let draggedId: string | null = null;
	let placeholder: HTMLElement | null = null;
	// HTML5 dragstart fires with `event.target = the draggable element`, not the
	// pointer's actual position. To gate drags by handle, capture where the
	// user pressed down — that's the real origin of the gesture.
	let mouseDownOnHandle = false;

	function clearPlaceholder() {
		if (placeholder?.parentElement) {
			placeholder.parentElement.removeChild(placeholder);
		}
		placeholder = null;
	}

	function ensurePlaceholder(): HTMLElement {
		if (placeholder) return placeholder;
		placeholder = document.createElement('div');
		placeholder.className = PLACEHOLDER_CLASS;
		return placeholder;
	}

	function clearDragVisuals() {
		if (draggedItem) {
			draggedItem.classList.remove(SOURCE_HIDDEN_CLASS);
		}
		clearPlaceholder();
		node.classList.remove(DRAGGING_CLASS);
		draggedItem = null;
		draggedId = null;
		window.removeEventListener('dragend', cleanupHandler);
		window.removeEventListener('drop', cleanupHandler);
		window.removeEventListener('blur', cleanupHandler);
	}

	const cleanupHandler = () => {
		clearDragVisuals();
	};

	function onMouseDown(event: MouseEvent) {
		if (!enabled) return;
		const target = event.target;
		if (!(target instanceof Element)) {
			mouseDownOnHandle = false;
			return;
		}
		mouseDownOnHandle = target.closest(`[${DRAG_HANDLE_ATTR}]`) !== null;
	}

	function onDragStart(event: DragEvent) {
		if (!enabled) return;
		const target = event.target;
		if (target instanceof Element) {
			const item = findItemElement(target, node);
			if (!item) return;

			// If any handle exists in the list, require the drag gesture to have
			// started on one. Use the captured mousedown — `event.target` for
			// dragstart is the draggable element, not where the pointer pressed.
			const hasHandles = node.querySelector(`[${DRAG_HANDLE_ATTR}]`) !== null;
			if (hasHandles && !mouseDownOnHandle) {
				event.preventDefault();
				return;
			}

			draggedItem = item;
			draggedId = item.dataset.reorderId ?? null;
		}
		if (!draggedItem || !draggedId) return;

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', draggedId);
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

	function onDragOver(event: DragEvent) {
		if (!enabled || !draggedItem) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

		const target = findItemElement(event.target, node);
		const ph = ensurePlaceholder();

		if (!target || target === draggedItem) {
			// Hovering over the list container itself or the dragged item — append
			// the placeholder at the end so the drop slot is always meaningful.
			if (ph.parentElement !== node || ph.nextElementSibling !== null) {
				node.appendChild(ph);
			}
			return;
		}

		const rect = target.getBoundingClientRect();
		const midpoint = rect.top + rect.height / 2;
		const insertBefore = event.clientY < midpoint;

		if (insertBefore) {
			if (target.previousElementSibling !== ph) {
				target.parentElement?.insertBefore(ph, target);
			}
		} else {
			if (target.nextElementSibling !== ph) {
				target.parentElement?.insertBefore(ph, target.nextElementSibling);
			}
		}
	}

	function onDrop(event: DragEvent) {
		if (!enabled || !draggedItem || !draggedId) return;
		event.preventDefault();

		// Move the dragged item to where the placeholder is sitting before
		// computing the new id order, so readIds reflects the final layout.
		if (placeholder?.parentElement) {
			placeholder.parentElement.insertBefore(draggedItem, placeholder);
		}
		clearPlaceholder();

		const ids = readIds(node);
		onReorder(ids);
		clearDragVisuals();
	}

	function onDragLeave(event: DragEvent) {
		// Only act when the cursor leaves the list container, not when crossing
		// between child items (which fire dragleave on the previous child).
		if (event.target === node && placeholder?.parentElement === node) {
			clearPlaceholder();
		}
	}

	node.addEventListener('mousedown', onMouseDown);
	node.addEventListener('dragstart', onDragStart);
	node.addEventListener('dragover', onDragOver);
	node.addEventListener('drop', onDrop);
	node.addEventListener('dragleave', onDragLeave);

	return {
		update(next: ReorderableOptions) {
			enabled = next.enabled;
			onReorder = next.onReorder;
			if (!enabled) clearDragVisuals();
		},
		destroy() {
			clearDragVisuals();
			node.removeEventListener('mousedown', onMouseDown);
			node.removeEventListener('dragstart', onDragStart);
			node.removeEventListener('dragover', onDragOver);
			node.removeEventListener('drop', onDrop);
			node.removeEventListener('dragleave', onDragLeave);
		},
	};
}
