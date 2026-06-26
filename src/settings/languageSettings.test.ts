import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageCustomizations } from './languageSettings.js';

type LanguageSettingsModule = typeof import('./languageSettings.js');

// CONFIG.NIMBLE is initialized + localized by tests/setup.ts, so these are the
// pristine built-in language maps before any customization is applied.
const PRISTINE_LANGUAGES = { ...CONFIG.NIMBLE.languages };
const PRISTINE_HINTS = { ...CONFIG.NIMBLE.languageHints };
const PRISTINE_IMAGES = { ...CONFIG.NIMBLE.languageImages };

let customizations: LanguageCustomizations;

function restorePristineConfig(): void {
	CONFIG.NIMBLE.languages = { ...PRISTINE_LANGUAGES } as typeof CONFIG.NIMBLE.languages;
	CONFIG.NIMBLE.languageHints = { ...PRISTINE_HINTS } as typeof CONFIG.NIMBLE.languageHints;
	CONFIG.NIMBLE.languageImages = { ...PRISTINE_IMAGES } as typeof CONFIG.NIMBLE.languageImages;
	CONFIG.NIMBLE.languageAliases = {};
}

async function loadModule(): Promise<LanguageSettingsModule> {
	// Fresh module so the captured baseline re-derives from the restored config.
	vi.resetModules();
	return import('./languageSettings.js');
}

beforeEach(() => {
	restorePristineConfig();
	customizations = { overrides: {}, custom: [] };
	(game as unknown as { settings: Record<string, ReturnType<typeof vi.fn>> }).settings = {
		get: vi.fn(() => customizations),
		set: vi.fn().mockResolvedValue(undefined),
		register: vi.fn(),
	};
});

describe('applyLanguageCustomizations', () => {
	it('renames a built-in language label without touching others', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = { goblin: { label: 'Orcish' } };

		applyLanguageCustomizations();

		expect(CONFIG.NIMBLE.languages.goblin).toBe('Orcish');
		expect(CONFIG.NIMBLE.languages.common).toBe(PRISTINE_LANGUAGES.common);
	});

	it('stores alternate names in languageAliases', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = { common: { aliases: ['Trade Tongue', 'Lingua'] } };

		applyLanguageCustomizations();

		expect(CONFIG.NIMBLE.languageAliases.common).toEqual(['Trade Tongue', 'Lingua']);
	});

	it('overrides hint and image for a built-in language', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = {
			elvish: { hint: 'Custom hint', image: 'icons/custom.webp' },
		};

		applyLanguageCustomizations();

		expect(CONFIG.NIMBLE.languageHints.elvish).toBe('Custom hint');
		expect(CONFIG.NIMBLE.languageImages.elvish).toBe('icons/custom.webp');
	});

	it('adds custom languages with their hint, image, and aliases', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.custom = [
			{
				key: 'sylvanCant',
				label: 'Sylvan Cant',
				aliases: ['Fey Speech'],
				hint: 'Spoken by the fey.',
				image: 'icons/sylvan.webp',
			},
		];

		applyLanguageCustomizations();

		const languages = CONFIG.NIMBLE.languages as Record<string, string>;
		const hints = CONFIG.NIMBLE.languageHints as Record<string, string>;
		const images = CONFIG.NIMBLE.languageImages as Record<string, string>;
		expect(languages.sylvanCant).toBe('Sylvan Cant');
		expect(hints.sylvanCant).toBe('Spoken by the fey.');
		expect(images.sylvanCant).toBe('icons/sylvan.webp');
		expect(CONFIG.NIMBLE.languageAliases.sylvanCant).toEqual(['Fey Speech']);
	});

	it('ignores overrides for unknown built-in keys', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = { notALanguage: { label: 'Nope' } };

		applyLanguageCustomizations();

		expect((CONFIG.NIMBLE.languages as Record<string, string>).notALanguage).toBeUndefined();
	});

	it('restores built-in defaults when an override is removed (idempotent)', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = { goblin: { label: 'Orcish' } };
		applyLanguageCustomizations();
		expect(CONFIG.NIMBLE.languages.goblin).toBe('Orcish');

		customizations.overrides = {};
		applyLanguageCustomizations();

		expect(CONFIG.NIMBLE.languages.goblin).toBe(PRISTINE_LANGUAGES.goblin);
		expect(CONFIG.NIMBLE.languageAliases).toEqual({});
	});
});

describe('registerLanguageSettings', () => {
	it('registers a world-scoped, non-config object setting', async () => {
		const { registerLanguageSettings } = await loadModule();
		const settingsMock = (game as unknown as { settings: { register: ReturnType<typeof vi.fn> } })
			.settings;

		registerLanguageSettings();

		const [, key, options] = settingsMock.register.mock.calls[0];
		expect(key).toBe('languageCustomizations');
		expect(options).toMatchObject({ scope: 'world', config: false });
	});
});
