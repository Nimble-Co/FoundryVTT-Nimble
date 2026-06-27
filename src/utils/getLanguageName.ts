import type { LanguageAlternateName } from '../settings/languageSettings.js';

interface GetLanguageNameOptions {
	/**
	 * Identifier of the speaking character's ancestry (e.g. "gnome"). When it
	 * matches an alternate-name binding for the language, that name is returned
	 * instead of the canonical/renamed label.
	 */
	ancestryIdentifier?: string | null;
}

/**
 * Resolve the display name for a language key. Returns the renamed/canonical
 * label by default. When the speaker's ancestry matches an alternate-name
 * binding, the canonical label is annotated with the ancestry's term for it —
 * e.g. a Gnome speaking `dwarvish` sees "Dwarvish (Gnomish)".
 *
 * The stored proficiency key is never changed — this only affects display, so
 * every place that prints a language name stays consistent.
 */
export default function getLanguageName(key: string, options?: GetLanguageNameOptions): string {
	const languages = CONFIG.NIMBLE.languages as Record<string, string>;
	const label = languages[key] ?? key;

	const ancestryIdentifier = options?.ancestryIdentifier;
	if (!ancestryIdentifier) return label;

	const bindings = (
		CONFIG.NIMBLE as unknown as {
			languageAlternateNames?: Record<string, LanguageAlternateName[]>;
		}
	).languageAlternateNames?.[key];
	if (!bindings?.length) return label;

	const match = bindings.find(
		(binding) => binding.name?.trim() && binding.ancestries?.includes(ancestryIdentifier),
	);
	if (!match) return label;

	// The alternate name is the ancestry's term; the canonical label stays so the
	// underlying language is never ambiguous (e.g. "Dwarvish (Gnomish)").
	const alternate = match.name.trim();
	return alternate === label ? label : `${label} (${alternate})`;
}
