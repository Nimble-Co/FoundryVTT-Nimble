export function draggable(node: HTMLElement, data) {
	let state = $state(data);

	node.draggable = true;
	node.style.cursor = 'grab';

	const dragstartHandler = (event: DragEvent) => {
		event.dataTransfer?.setData('text/plain', state);
	};

	node.addEventListener('dragstart', dragstartHandler);

	return {
		update() {
			state = data;
		},
		destroy() {
			node.removeEventListener('dragstart', dragstartHandler);
		},
	};
}
