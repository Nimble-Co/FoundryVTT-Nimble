import type { Snippet } from 'svelte';

interface WindowHeadBase {
	/** the name of the window; `name` replaces it with a field */
	title?: string;
	img?: string;
	icon?: string;
	/** a short line under the name */
	sub?: string;
	name?: Snippet;
}

/** With `ontile` the tile is a button, for example to change the image, and needs a label. */
export type WindowHeadProps = WindowHeadBase &
	(
		| { ontile: (event: MouseEvent) => void; tileLabel: string }
		| { ontile?: undefined; tileLabel?: undefined }
	);
