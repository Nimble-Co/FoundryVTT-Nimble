import type { ChoiceMenuProps } from '#types/components/ChoiceMenu.d.ts';
import { claimEscape } from './claimEscape.ts';

export function createChoiceMenuState(
	getProps: () => Pick<ChoiceMenuProps, 'sections' | 'trigger' | 'onclose'>,
) {
	const elements = $state<{ menu?: HTMLDivElement; items: HTMLButtonElement[] }>({ items: [] });

	/** Where each section's items start in the one list the arrow keys move through. */
	const starts = $derived.by(() => {
		let next = 0;
		return getProps().sections.map((section) => {
			const start = next;
			next += section.items.length;
			return start;
		});
	});

	function onKeydown(event: KeyboardEvent) {
		const { items } = elements;
		const current = items.indexOf(event.target as HTMLButtonElement);
		const last =
			getProps().sections.reduce((count, section) => count + section.items.length, 0) - 1;
		const next = {
			ArrowDown: current >= last ? 0 : current + 1,
			ArrowUp: current <= 0 ? last : current - 1,
			Home: 0,
			End: last,
		}[event.key];

		if (next !== undefined) {
			event.preventDefault();
			items[next]?.focus();
		} else if (claimEscape(event)) {
			getProps().onclose(true);
		} else if (event.key === 'Tab') {
			getProps().onclose(false);
		}
	}

	function onWindowPointerDown(event: PointerEvent) {
		const target = event.target as Node | null;
		if (getProps().trigger?.contains(target) || elements.menu?.contains(target)) return;
		getProps().onclose(false);
	}

	function focusFirst() {
		elements.menu?.scrollIntoView?.({ block: 'nearest' });
		elements.items[0]?.focus({ preventScroll: true });
	}

	return {
		elements,
		get starts() {
			return starts;
		},
		onKeydown,
		onWindowPointerDown,
		focusFirst,
	};
}
