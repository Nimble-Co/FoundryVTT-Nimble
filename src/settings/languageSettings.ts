import { SYSTEM_ID } from '#system';

export const LANGUAGE_CUSTOMIZATIONS_SETTING_KEY = 'languageCustomizations';

/**
 * One ancestry that speaks a language, plus the name that ancestry uses for it.
 * `alias` empty means the ancestry calls the language by its normal name; a
 * non-empty alias is shown instead (e.g. a Gnome calls `dwarvish` "Gnomish").
 */
export interface LanguageSpeaker {
	/** Ancestry identifier (slugified name, e.g. "gnome"). */
	ancestry: string;
	/** The ancestry's name for this language ('' = the language's normal name). */
	alias: string;
}

/**
 * Display-time alternate-name binding consumed by `getLanguageName`. Built into
 * `CONFIG.NIMBLE.languageAlternateNames` by {@link applyLanguageCustomizations}.
 */
export interface LanguageAlternateName {
	/** The display name shown to matching ancestries (e.g. "Gnomish"). */
	name: string;
	/** Ancestry identifiers that use this name. */
	ancestries: string[];
}

/** Sparse override applied on top of a built-in language. */
export interface LanguageOverride {
	/** World-wide renamed display label (falls back to the built-in label). */
	label?: string;
	/** Replacement tooltip hint. */
	hint?: string;
	/** Full "spoken by" list when the GM has changed it from the ancestry defaults. */
	speakers?: LanguageSpeaker[];
}

/** A fully GM-authored language. */
export interface CustomLanguage {
	/** Stable key, generated from the label and unique across all languages. */
	key: string;
	label: string;
	hint: string;
	speakers: LanguageSpeaker[];
}

export interface LanguageCustomizations {
	/** Overrides for built-in languages, keyed by built-in language key. */
	overrides: Record<string, LanguageOverride>;
	/** Languages added by the GM. */
	custom: CustomLanguage[];
	/** When false, ancestry alias names are ignored for display (grants still apply). */
	alternateNamesEnabled: boolean;
}

const DEFAULT_CUSTOMIZATIONS: LanguageCustomizations = {
	overrides: {},
	custom: [],
	alternateNamesEnabled: true,
};

/**
 * Localized snapshot of the built-in language maps, captured the first time
 * customizations are applied (after `i18nInit` has localized them). Used as the
 * immutable baseline so every re-apply starts from the shipped defaults rather
 * than from previously-merged values.
 */
let baseline: {
	languages: Record<string, string>;
	languageHints: Record<string, string>;
} | null = null;

function captureBaseline(): void {
	if (baseline) return;

	baseline = {
		languages: { ...CONFIG.NIMBLE.languages },
		languageHints: { ...CONFIG.NIMBLE.languageHints },
	};
}

/**
 * The localized, un-customized built-in language maps. Used by the editor UI to
 * show defaults and detect which fields the GM has actually overridden.
 */
export function getBuiltinLanguageBaseline(): {
	languages: Record<string, string>;
	languageHints: Record<string, string>;
} {
	captureBaseline();
	return (
		baseline ?? {
			languages: { ...CONFIG.NIMBLE.languages },
			languageHints: { ...CONFIG.NIMBLE.languageHints },
		}
	);
}

export function getLanguageCustomizations(): LanguageCustomizations {
	const stored = game.settings.get(
		SYSTEM_ID as 'core',
		LANGUAGE_CUSTOMIZATIONS_SETTING_KEY as 'rollMode',
	) as unknown as Partial<LanguageCustomizations> | undefined;

	return {
		overrides: stored?.overrides ?? {},
		custom: stored?.custom ?? [],
		alternateNamesEnabled: stored?.alternateNamesEnabled ?? true,
	};
}

export async function setLanguageCustomizations(value: LanguageCustomizations): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		LANGUAGE_CUSTOMIZATIONS_SETTING_KEY as 'rollMode',
		value as unknown as never,
	);
}

/**
 * Default "spoken by" list per language, derived from ancestry items (their
 * `grantProficiency` language rules; `displayAs` becomes the alias). Built once
 * at startup by scanning world + compendium ancestries. These ship with the
 * Nimble rules so the right speakers and names appear with zero GM setup.
 */
let ancestryLanguageDefaults: Record<string, LanguageSpeaker[]> = {};

interface AncestryLike {
	type?: string;
	name?: string;
	identifier?: string;
	system?: { rules?: Array<Record<string, unknown>> };
}

/** Resolve an ancestry's stable identifier (slugified name fallback). */
function ancestryIdentifierOf(ancestry: AncestryLike): string {
	if (ancestry.identifier) return ancestry.identifier;
	const name = ancestry.name ?? '';
	return (
		(name as unknown as { slugify?: (o: { strict: boolean }) => string }).slugify?.({
			strict: true,
		}) ?? ''
	);
}

/** Group an ancestryId→name map into `{ name, ancestries }[]` bindings. */
function groupBindingsByName(byAncestry: Map<string, string>): LanguageAlternateName[] {
	const byName = new Map<string, string[]>();
	for (const [ancestryId, name] of byAncestry) {
		const ancestries = byName.get(name) ?? [];
		ancestries.push(ancestryId);
		byName.set(name, ancestries);
	}
	return [...byName.entries()].map(([name, ancestries]) => ({ name, ancestries }));
}

/**
 * Scan world + compendium ancestry items for language grants, and cache them as
 * the built-in "spoken by" defaults (ancestry + any `displayAs` alias). Async
 * because compendium rules live on full documents (not the index). Call once on
 * `ready` before {@link applyLanguageCustomizations}.
 */
export async function loadAncestryLanguageDefaults(): Promise<void> {
	// language key -> (ancestry identifier -> alias)
	const byKey = new Map<string, Map<string, string>>();

	const collect = (items: Iterable<AncestryLike>): void => {
		for (const item of items) {
			if (item?.type !== 'ancestry') continue;
			const identifier = ancestryIdentifierOf(item);
			if (!identifier) continue;

			for (const rule of item.system?.rules ?? []) {
				if (rule.type !== 'grantProficiency' || rule.proficiencyType !== 'languages') continue;
				const alias = String(rule.displayAs ?? '').trim();

				for (const langKey of (rule.values as string[] | undefined) ?? []) {
					const byAncestry = byKey.get(langKey) ?? new Map<string, string>();
					// Don't clobber an alias with a later empty one.
					if (alias || !byAncestry.has(identifier)) byAncestry.set(identifier, alias);
					byKey.set(langKey, byAncestry);
				}
			}
		}
	};

	collect((game.items ?? []) as unknown as Iterable<AncestryLike>);

	for (const pack of (game.packs ?? []) as unknown as Iterable<{
		documentName?: string;
		index?: Iterable<{ type?: string }>;
		getDocuments: (query?: object) => Promise<unknown[]>;
	}>) {
		if (pack.documentName !== 'Item') continue;
		const hasAncestry = [...(pack.index ?? [])].some((entry) => entry.type === 'ancestry');
		if (!hasAncestry) continue;

		const docs = await pack
			.getDocuments({ type: 'ancestry' })
			.catch(() => pack.getDocuments())
			.catch(() => []);
		collect(docs as Iterable<AncestryLike>);
	}

	const defaults: Record<string, LanguageSpeaker[]> = {};
	for (const [key, byAncestry] of byKey) {
		defaults[key] = [...byAncestry.entries()].map(([ancestry, alias]) => ({ ancestry, alias }));
	}
	ancestryLanguageDefaults = defaults;
}

/** The cached ancestry-derived "spoken by" defaults (see loader above). */
export function getAncestryLanguageDefaults(): Record<string, LanguageSpeaker[]> {
	return ancestryLanguageDefaults;
}

/** Normalize a display name for case-insensitive conflict comparison. */
function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * Detect languages that would share the same effective primary display name.
 * `entries` is the full set of effective names (renamed built-ins, untouched
 * built-ins, and custom languages), each tagged with a stable `id`. Returns the
 * ids of every entry that collides with at least one other. Pure + side-effect
 * free so the editor and tests can share it.
 */
export function findLanguageNameConflicts(entries: { id: string; name: string }[]): Set<string> {
	const byName = new Map<string, string[]>();
	for (const entry of entries) {
		const key = normalizeName(entry.name);
		if (!key) continue;
		const ids = byName.get(key) ?? [];
		ids.push(entry.id);
		byName.set(key, ids);
	}

	const conflicting = new Set<string>();
	for (const ids of byName.values()) {
		if (ids.length > 1) for (const id of ids) conflicting.add(id);
	}
	return conflicting;
}

/**
 * Rebuild the language config from the immutable baseline + ancestry defaults +
 * stored GM customizations:
 *  - `CONFIG.NIMBLE.languages` / `languageHints` — renamed labels and tooltips.
 *  - `CONFIG.NIMBLE.languageAlternateNames` — display aliases per ancestry (used
 *    by `getLanguageName`); skipped when `alternateNamesEnabled` is false.
 *  - `CONFIG.NIMBLE.languageSpeakers` — ancestry→language grants the GM ADDED
 *    beyond the ancestry rules (applied to characters at data-prep time). The
 *    built-in ancestry grants still come from the ancestry items themselves.
 * Idempotent: derives entirely from the baseline + defaults each call.
 */
export function applyLanguageCustomizations(): void {
	captureBaseline();
	if (!baseline) return;

	const { overrides, custom, alternateNamesEnabled } = getLanguageCustomizations();

	const languages: Record<string, string> = { ...baseline.languages };
	const languageHints: Record<string, string> = { ...baseline.languageHints };
	const languageAlternateNames: Record<string, LanguageAlternateName[]> = {};
	const languageSpeakers: Record<string, string[]> = {};

	const recordSpeakers = (key: string, speakers: LanguageSpeaker[]) => {
		// Display aliases (ancestry -> alias) for this language.
		if (alternateNamesEnabled) {
			const byAncestry = new Map<string, string>();
			for (const speaker of speakers) {
				const alias = speaker.alias?.trim();
				if (alias && speaker.ancestry) byAncestry.set(speaker.ancestry, alias);
			}
			if (byAncestry.size) languageAlternateNames[key] = groupBindingsByName(byAncestry);
		}

		// Full effective grant list: every ancestry that speaks the language. This
		// is authoritative — the ancestry items' own language grants defer to it.
		const ancestries = [...new Set(speakers.map((s) => s.ancestry).filter(Boolean))];
		if (ancestries.length) languageSpeakers[key] = ancestries;
	};

	// Built-in languages: effective speakers = GM override, else ancestry defaults.
	for (const key of Object.keys(baseline.languages)) {
		const override = overrides[key];
		if (override?.label) languages[key] = override.label;
		if (override?.hint !== undefined) languageHints[key] = override.hint;

		recordSpeakers(key, override?.speakers ?? ancestryLanguageDefaults[key] ?? []);
	}

	// GM custom languages.
	for (const language of custom) {
		if (!language.key || !language.label) continue;
		languages[language.key] = language.label;
		languageHints[language.key] = language.hint ?? '';
		recordSpeakers(language.key, language.speakers ?? []);
	}

	CONFIG.NIMBLE.languages = languages as typeof CONFIG.NIMBLE.languages;
	CONFIG.NIMBLE.languageHints = languageHints as typeof CONFIG.NIMBLE.languageHints;
	CONFIG.NIMBLE.languageAlternateNames = languageAlternateNames;
	const nimble = CONFIG.NIMBLE as unknown as {
		languageSpeakers: Record<string, string[]>;
		languageGrantsManaged: boolean;
	};
	nimble.languageSpeakers = languageSpeakers;
	// Signals the grant rule that ancestry language grants are now governed here.
	nimble.languageGrantsManaged = true;
}

/**
 * Re-render the sheets and dialogs that read language config at render time, so
 * customization edits appear without a reload. Svelte components capture
 * `CONFIG.NIMBLE` at script init, so re-rendering the host re-instantiates them.
 */
function rerenderLanguageConsumers(): void {
	const shouldRerender = (name: string | undefined): boolean =>
		name === 'PlayerCharacterSheet' ||
		name === 'CharacterCreationDialog' ||
		name === 'GenericDialog';

	const v1 = Object.values(ui.windows ?? {}) as Array<{
		render?: (force?: boolean) => void;
		constructor: { name: string };
	}>;
	for (const app of v1) {
		if (shouldRerender(app.constructor?.name)) app.render?.(false);
	}

	const v2 = (foundry.applications?.instances ?? new Map()) as Map<
		string,
		{ render?: (force?: boolean) => void; constructor: { name: string } }
	>;
	v2.forEach((app) => {
		if (shouldRerender(app.constructor?.name)) app.render?.(false);
	});
}

export function registerLanguageSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		LANGUAGE_CUSTOMIZATIONS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.languageCustomization.name',
			hint: 'NIMBLE.settings.languageCustomization.hint',
			scope: 'world',
			config: false,
			type: Object,
			default: DEFAULT_CUSTOMIZATIONS,
			onChange: () => {
				applyLanguageCustomizations();
				// Re-prepare characters so added/removed language grants take effect live.
				for (const actor of game.actors ?? []) {
					if (actor?.type === 'character') actor.prepareData?.();
				}
				rerenderLanguageConsumers();
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}
