import { tick } from 'svelte';
import type { SheetUiState } from './sheetUiState.ts';

/** The width of the sheet root, from a ResizeObserver. Call it while the component starts. */
export function trackWidth(root: () => HTMLElement | undefined, initial: number) {
	let width = $state(initial);
	$effect(() => {
		const element = root();
		if (!element || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(([entry]) => {
			width = entry.contentRect.width;
		});
		observer.observe(element);
		return () => observer.disconnect();
	});
	return {
		get width() {
			return width;
		},
	};
}

/** Scrolls to the row that `reveal()` flashes and starts its flash. Call it while the component starts. */
export function flashRows(
	root: () => HTMLElement | undefined,
	flashOf: () => SheetUiState['flash'],
): void {
	$effect(() => {
		const flash = flashOf();
		const element = root();
		if (!flash || !element) return;
		let row: HTMLElement | null = null;
		const done = (event: AnimationEvent) => {
			if (row && event.target === row) delete row.dataset.flash;
		};
		void tick().then(() => {
			row = element.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(flash.rowId)}"]`);
			if (!row) return;
			row.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
			// a reflow between the two writes starts the animation again on a second reveal
			delete row.dataset.flash;
			void row.offsetWidth;
			row.dataset.flash = String(flash.serial);
			row.addEventListener('animationend', done);
		});
		return () => row?.removeEventListener('animationend', done);
	});
}
