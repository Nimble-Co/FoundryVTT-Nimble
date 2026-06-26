import { SYSTEM_ID } from '#system';

export const LANGUAGE_CUSTOMIZATIONS_SETTING_KEY = 'languageCustomizations';

/** Sparse override applied on top of a built-in language. */
export interface LanguageOverride {
	/** Renamed display label (falls back to the built-in label when omitted). */
	label?: string;
	/** Alternate display names shown alongside the label. */
	aliases?: string[];
	/** Replacement tooltip hint. */
	hint?: string;
	/** Replacement icon path. */
	image?: string;
}

/** A fully GM-authored language. */
export interface CustomLanguage {
	/** Stable key, generated from the label and unique across all languages. */
	key: string;
	label: string;
	aliases: string[];
	hint: string;
	image: string;
}

export interface LanguageCustomizations {
	/** Overrides for built-in languages, keyed by built-in language key. */
	overrides: Record<string, LanguageOverride>;
	/** Languages added by the GM. */
	custom: CustomLanguage[];
}

const DEFAULT_CUSTOMIZATIONS: LanguageCustomizations = { overrides: {}, custom: [] };

/**
 * Localized snapshot of the built-in language maps, captured the first time
 * customizations are applied (after `i18nInit` has localized them). Used as the
 * immutable baseline so every re-apply starts from the shipped defaults rather
 * than from previously-merged values.
 */
let baseline: {
	languages: Record<string, string>;
	languageHints: Record<string, string>;
	languageImages: Record<string, string>;
} | null = null;

function captureBaseline(): void {
	if (baseline) return;

	baseline = {
		languages: { ...CONFIG.NIMBLE.languages },
		languageHints: { ...CONFIG.NIMBLE.languageHints },
		languageImages: { ...CONFIG.NIMBLE.languageImages },
	};
}

/**
 * The localized, un-customized built-in language maps. Used by the editor UI to
 * show defaults and detect which fields the GM has actually overridden.
 */
export function getBuiltinLanguageBaseline(): {
	languages: Record<string, string>;
	languageHints: Record<string, string>;
	languageImages: Record<string, string>;
} {
	captureBaseline();
	return (
		baseline ?? {
			languages: { ...CONFIG.NIMBLE.languages },
			languageHints: { ...CONFIG.NIMBLE.languageHints },
			languageImages: { ...CONFIG.NIMBLE.languageImages },
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
 * Rebuild `CONFIG.NIMBLE.languages`, `languageHints`, `languageImages`, and
 * `languageAliases` from the immutable baseline plus the stored customizations.
 * Idempotent: always derives from `baseline`, so removing an override restores
 * the built-in default.
 */
export function applyLanguageCustomizations(): void {
	captureBaseline();
	if (!baseline) return;

	const { overrides, custom } = getLanguageCustomizations();

	const languages: Record<string, string> = { ...baseline.languages };
	const languageHints: Record<string, string> = { ...baseline.languageHints };
	const languageImages: Record<string, string> = { ...baseline.languageImages };
	const languageAliases: Record<string, string[]> = {};

	// Apply overrides to built-in languages.
	for (const [key, override] of Object.entries(overrides)) {
		if (!(key in baseline.languages)) continue;
		if (override.label) languages[key] = override.label;
		if (override.hint !== undefined) languageHints[key] = override.hint;
		if (override.image) languageImages[key] = override.image;
		if (override.aliases?.length) languageAliases[key] = [...override.aliases];
	}

	// Add custom languages.
	for (const language of custom) {
		if (!language.key || !language.label) continue;
		languages[language.key] = language.label;
		languageHints[language.key] = language.hint ?? '';
		languageImages[language.key] = language.image ?? '';
		if (language.aliases?.length) languageAliases[language.key] = [...language.aliases];
	}

	CONFIG.NIMBLE.languages = languages as typeof CONFIG.NIMBLE.languages;
	CONFIG.NIMBLE.languageHints = languageHints as typeof CONFIG.NIMBLE.languageHints;
	CONFIG.NIMBLE.languageImages = languageImages as typeof CONFIG.NIMBLE.languageImages;
	CONFIG.NIMBLE.languageAliases = languageAliases;
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
				rerenderLanguageConsumers();
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}
