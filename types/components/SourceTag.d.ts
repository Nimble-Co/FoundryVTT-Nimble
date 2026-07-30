export interface SourceTagProps {
	/**
	 * Where the tagged document lives — the vocabulary `getItemSource()` returns. `'world'` for a
	 * locally created or customized item, `'compendium'` for one from a published pack.
	 */
	source: 'world' | 'compendium';
}
