import type { Snippet } from 'svelte';

export interface WindowHeadProps {
	/** the name of the window; `name` replaces it with a field */
	title?: string;
	img?: string;
	icon?: string;
	/** a short line under the name */
	sub?: string;
	/** makes the tile a button, for example to change the image */
	ontile?: (event: MouseEvent) => void;
	tileLabel?: string;
	name?: Snippet;
}
