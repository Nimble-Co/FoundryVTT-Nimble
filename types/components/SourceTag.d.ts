import type { ItemSource } from '#utils/documents/getItemSource.ts';

export interface SourceTagProps {
	/** Where the tagged document lives — the vocabulary `getItemSource()` returns. */
	source: ItemSource;
}
