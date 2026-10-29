import localize from '#utils/localize.js';

/** A CONFIG table of language keys, as the names in the language of the user. */
export function localizeAll(keys: Record<string, string> | undefined): Record<string, string> {
	return Object.fromEntries(Object.entries(keys ?? {}).map(([key, name]) => [key, localize(name)]));
}
