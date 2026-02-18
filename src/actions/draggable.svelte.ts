function applyDragState(node: HTMLElement, state: string | null | undefined) {
	const isDraggable = typeof state === 'string' && state.length > 0;
	node.draggable = isDraggable;
	node.style.cursor = isDraggable ? 'grab' : 'default';
}

function setGlobalDragMode(active: boolean) {
	document.body.classList.toggle('nimble-combat-tracker--dragging', active);
}

function suppressNextOverlayButtonClick() {
	const suppressHandler = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest('.nimble-combatant-controls-overlay__button')) return;

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	};

	window.addEventListener('click', suppressHandler, { capture: true, once: true });
}

export function draggable(node: HTMLElement, data: string | null | undefined) {
	let state = $state(data);
	applyDragState(node, data);
	let sourceHidden = false;
	let isDragging = false;
	let dragMotionHandler: ((event: DragEvent) => void) | null = null;

	function clearAllDragSourceHidden() {
		for (const element of document.querySelectorAll<HTMLElement>(
			'.nimble-combatant--drag-source-hidden',
		)) {
			element.classList.remove('nimble-combatant--drag-source-hidden');
		}
	}

	function clearAllDragImages() {
		for (const element of document.querySelectorAll<HTMLElement>('.nimble-combatant--drag-image')) {
			element.remove();
		}
	}

	function hideSourceCard() {
		if (sourceHidden) return;
		node.classList.add('nimble-combatant--drag-source-hidden');
		sourceHidden = true;
	}

	function clearDragVisuals() {
		if (dragMotionHandler) {
			window.removeEventListener('dragover', dragMotionHandler);
			dragMotionHandler = null;
		}

		window.removeEventListener('drop', globalCleanupHandler);
		window.removeEventListener('dragend', globalCleanupHandler);
		window.removeEventListener('pointerup', globalCleanupHandler);
		window.removeEventListener('mouseup', globalCleanupHandler);
		window.removeEventListener('blur', globalCleanupHandler);

		clearAllDragImages();
		clearAllDragSourceHidden();
		setGlobalDragMode(false);
		isDragging = false;
		sourceHidden = false;
	}

	const dragstartHandler = (event: DragEvent) => {
		if (!node.draggable) return;
		clearDragVisuals();

		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer?.setData('text/plain', state ?? '');
		isDragging = true;
		setGlobalDragMode(true);

		const rect = node.getBoundingClientRect();
		const offsetX =
			event.clientX && event.clientY ? event.clientX - rect.left : Math.round(rect.width / 2);
		const offsetY =
			event.clientX && event.clientY ? event.clientY - rect.top : Math.round(rect.height / 2);

		const dragImage = node.cloneNode(true) as HTMLElement;
		dragImage.classList.add('nimble-combatant--drag-image');
		dragImage.style.width = `${rect.width}px`;
		dragImage.style.height = `${rect.height}px`;

		document.body.appendChild(dragImage);

		dragMotionHandler = (dragEvent: DragEvent) => {
			if (!isDragging) return;
			if (dragEvent.clientX === 0 && dragEvent.clientY === 0) return;
			hideSourceCard();
		};
		window.addEventListener('dragover', dragMotionHandler);

		if (event.dataTransfer) {
			event.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
		}

		window.addEventListener('drop', globalCleanupHandler);
		window.addEventListener('dragend', globalCleanupHandler);
		window.addEventListener('pointerup', globalCleanupHandler);
		window.addEventListener('mouseup', globalCleanupHandler);
		window.addEventListener('blur', globalCleanupHandler);

		const combatantId = node.dataset.combatantId;
		if (combatantId) {
			window.dispatchEvent(
				new CustomEvent('nimble-combatant-dragstart', {
					detail: { combatantId },
				}),
			);
		}
	};

	const dragendHandler = () => {
		clearDragVisuals();
		// Guard against accidental GM overlay icon clicks immediately after drag release.
		// This does not suppress normal controls like End Turn or tracker header buttons.
		suppressNextOverlayButtonClick();
		window.dispatchEvent(new CustomEvent('nimble-combatant-dragend'));
	};

	const globalCleanupHandler = () => {
		clearDragVisuals();
	};

	node.addEventListener('dragstart', dragstartHandler);
	node.addEventListener('dragend', dragendHandler);

	return {
		update(nextData: string | null | undefined) {
			state = nextData;
			applyDragState(node, state);
		},
		destroy() {
			clearDragVisuals();
			node.removeEventListener('dragstart', dragstartHandler);
			node.removeEventListener('dragend', dragendHandler);
			node.draggable = false;
			node.style.cursor = 'default';
		},
	};
}
