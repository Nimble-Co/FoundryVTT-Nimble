/**
 * Svelte action for native HTML5 list reorder. Mirrors the pattern of
 * `draggable.svelte.ts` but is scoped to intra-list reorder rather than the
 * combat-tracker semantics. Per AGENTS.md Code Promotion Rules, kept as a
 * sibling action — extract a shared base if a third use case appears.
 *
 * Apply to a list container; each child must carry a `data-reorder-id`
 * attribute. On drop, dispatches a `reorder` CustomEvent with
 * `{ detail: { ids: string[] } }` reflecting the new id order. The
 * consumer wires the event to e.g. `RulesManager.reorderRules`.
 */

interface ReorderableOptions {
	/** Apply or remove the action. Allows toggling without re-mounting the list. */
	enabled: boolean;
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
	options: ReorderableOptions = { enabled: true },
): ReorderableActionReturn {
	let enabled = options.enabled;
	let draggedItem: HTMLElement | null = null;
	let draggedId: string | null = null;
	let placeholder: HTMLElement | null = null;

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

	function onDragStart(event: DragEvent) {
		if (!enabled) return;
		// Only initiate from a reorder handle, not arbitrary content within an item.
		// If the consumer doesn't provide a handle, fall back to the whole item.
		const target = event.target;
		if (target instanceof Element) {
			const explicitHandle = target.closest(`[${DRAG_HANDLE_ATTR}]`);
			const item = findItemElement(target, node);
			if (!item) return;

			// If any handle exists in the list, require the drag to originate inside one.
			const hasHandles = node.querySelector(`[${DRAG_HANDLE_ATTR}]`) !== null;
			if (hasHandles && !explicitHandle) {
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
		node.dispatchEvent(
			new CustomEvent('reorder', {
				bubbles: true,
				detail: { ids },
			}),
		);
		clearDragVisuals();
	}

	function onDragLeave(event: DragEvent) {
		// Only act when the cursor leaves the list container, not when crossing
		// between child items (which fire dragleave on the previous child).
		if (event.target === node && placeholder?.parentElement === node) {
			clearPlaceholder();
		}
	}

	node.addEventListener('dragstart', onDragStart);
	node.addEventListener('dragover', onDragOver);
	node.addEventListener('drop', onDrop);
	node.addEventListener('dragleave', onDragLeave);

	return {
		update(next: ReorderableOptions) {
			enabled = next.enabled;
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
