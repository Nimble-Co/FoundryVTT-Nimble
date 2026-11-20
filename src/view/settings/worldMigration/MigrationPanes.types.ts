import type { Snippet } from 'svelte';

export interface MigrationPanesProps {
	/** The left pane: the list to pick from. */
	side: Snippet;
	/** The right pane: what the pick shows. */
	main: Snippet;
}
