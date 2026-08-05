import { describe, expect, it } from 'vitest';

import { tooltipWhenClipped } from './DuplicateSourceGroup.svelte.ts';

/** Builds an element with the given measured widths, which jsdom/happy-dom never compute. */
function elementWithWidths(text: string, scrollWidth: number, clientWidth: number): HTMLElement {
	const node = document.createElement('span');
	node.textContent = text;
	Object.defineProperty(node, 'scrollWidth', { value: scrollWidth, configurable: true });
	Object.defineProperty(node, 'clientWidth', { value: clientWidth, configurable: true });
	return node;
}

describe('tooltipWhenClipped', () => {
	it('adds the full text as a tooltip when the line is clipped', () => {
		const node = elementWithWidths('identical to Nimble Class Features', 400, 200);

		tooltipWhenClipped(node);

		expect(node.getAttribute('data-tooltip')).toBe('identical to Nimble Class Features');
	});

	it('adds no tooltip when the text already fits', () => {
		const node = elementWithWidths('packaged default', 120, 200);

		tooltipWhenClipped(node);

		expect(node.hasAttribute('data-tooltip')).toBe(false);
	});

	it('treats a sub-pixel overhang as fitting rather than clipped', () => {
		const node = elementWithWidths('packaged default', 201, 200);

		tooltipWhenClipped(node);

		expect(node.hasAttribute('data-tooltip')).toBe(false);
	});

	it('drops the tooltip when the element grows enough to fit', () => {
		const node = elementWithWidths('identical to Nimble Class Features', 400, 200);
		const action = tooltipWhenClipped(node);
		expect(node.hasAttribute('data-tooltip')).toBe(true);

		Object.defineProperty(node, 'clientWidth', { value: 500, configurable: true });
		action.update();

		expect(node.hasAttribute('data-tooltip')).toBe(false);
	});

	it('cleans up without throwing when the element goes away', () => {
		const action = tooltipWhenClipped(elementWithWidths('anything', 400, 200));

		expect(() => action.destroy()).not.toThrow();
	});
});
