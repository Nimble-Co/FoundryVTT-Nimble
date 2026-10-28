/**
 * Shows `data-tooltip` as Foundry's TooltipManager does: on the element under the pointer that holds the attribute,
 * with `aria-label` when the attribute is empty. A child of a button gets no pointer events (see preview.css),
 * so a tooltip on it never shows, as in Foundry.
 */
export function installTooltips() {
	const tip = document.createElement('div');
	tip.id = 'tooltip';
	tip.setAttribute('role', 'tooltip');
	tip.hidden = true;
	document.body.append(tip);

	let active: HTMLElement | null = null;

	const hide = () => {
		active = null;
		tip.hidden = true;
	};

	const show = (element: HTMLElement, text: string) => {
		active = element;
		tip.textContent = text;
		tip.hidden = false;
		const box = element.getBoundingClientRect();
		const width = tip.offsetWidth;
		const left = Math.min(
			Math.max(4, box.left + box.width / 2 - width / 2),
			window.innerWidth - width - 4,
		);
		const top = box.top - tip.offsetHeight - 6;
		tip.style.left = `${left}px`;
		tip.style.top = `${top < 4 ? box.bottom + 6 : top}px`;
	};

	document.body.addEventListener(
		'pointerenter',
		(event) => {
			const element = event.target;
			if (!(element instanceof HTMLElement)) return;
			const attribute = element.dataset.tooltip;
			const text = attribute || (attribute === '' ? element.ariaLabel : null);
			if (text) show(element, text);
			else if (active && !active.contains(element)) hide();
		},
		{ capture: true, passive: true },
	);
	document.body.addEventListener(
		'pointerleave',
		(event) => {
			if (event.target === active) hide();
		},
		{ capture: true, passive: true },
	);
	document.addEventListener('pointerdown', hide, { capture: true, passive: true });
}
