import { beforeEach, describe, expect, it, vi } from 'vitest';
import getLanguageName from '../utils/getLanguageName.js';
import { findLanguageNameConflicts, type LanguageCustomizations } from './languageSettings.js';

type LanguageSettingsModule = typeof import('./languageSettings.js');

// CONFIG.NIMBLE is initialized + localized by tests/setup.ts, so these are the
// pristine built-in language maps before any customization is applied.
const PRISTINE_LANGUAGES = { ...CONFIG.NIMBLE.languages };
const PRISTINE_HINTS = { ...CONFIG.NIMBLE.languageHints };

let customizations: LanguageCustomizations;

type NimbleConfig = {
	languages: Record<string, string>;
	languageHints: Record<string, string>;
	languageAlternateNames: Record<string, unknown>;
	languageSpeakers: Record<string, string[]>;
	languageGrantsManaged?: boolean;
};

function nimble(): NimbleConfig {
	return CONFIG.NIMBLE as unknown as NimbleConfig;
}

function restorePristineConfig(): void {
	const config = nimble();
	config.languages = { ...PRISTINE_LANGUAGES };
	config.languageHints = { ...PRISTINE_HINTS };
	config.languageAlternateNames = {};
	config.languageSpeakers = {};
	config.languageGrantsManaged = false;
}

async function loadModule(): Promise<LanguageSettingsModule> {
	// Fresh module so the captured baseline re-derives from the restored config.
	vi.resetModules();
	return import('./languageSettings.js');
}

beforeEach(() => {
	restorePristineConfig();
	customizations = { overrides: {}, custom: [], alternateNamesEnabled: true };
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

	it('publishes ancestry aliases and speakers from a GM override', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = {
			dwarvish: {
				speakers: [
					{ ancestry: 'dwarf', alias: '' },
					{ ancestry: 'gnome', alias: 'Gnomish' },
				],
			},
		};

		applyLanguageCustomizations();

		expect(nimble().languageAlternateNames.dwarvish).toEqual([
			{ name: 'Gnomish', ancestries: ['gnome'] },
		]);
		expect(nimble().languageSpeakers.dwarvish).toEqual(['dwarf', 'gnome']);
		expect(nimble().languageGrantsManaged).toBe(true);
	});

	it('omits aliases when alternate names are disabled (grants still publish)', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.alternateNamesEnabled = false;
		customizations.overrides = {
			dwarvish: { speakers: [{ ancestry: 'gnome', alias: 'Gnomish' }] },
		};

		applyLanguageCustomizations();

		expect(nimble().languageAlternateNames).toEqual({});
		expect(nimble().languageSpeakers.dwarvish).toEqual(['gnome']);
	});

	it('overrides the hint for a built-in language', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.overrides = { elvish: { hint: 'Custom hint' } };

		applyLanguageCustomizations();

		expect(CONFIG.NIMBLE.languageHints.elvish).toBe('Custom hint');
	});

	it('adds custom languages with their hint and speakers', async () => {
		const { applyLanguageCustomizations } = await loadModule();
		customizations.custom = [
			{
				key: 'sylvanCant',
				label: 'Sylvan Cant',
				hint: 'Spoken by the fey.',
				speakers: [{ ancestry: 'dryadshroomling', alias: 'Fey Speech' }],
			},
		];

		applyLanguageCustomizations();

		const languages = CONFIG.NIMBLE.languages as Record<string, string>;
		const hints = CONFIG.NIMBLE.languageHints as Record<string, string>;
		expect(languages.sylvanCant).toBe('Sylvan Cant');
		expect(hints.sylvanCant).toBe('Spoken by the fey.');
		expect(nimble().languageAlternateNames.sylvanCant).toEqual([
			{ name: 'Fey Speech', ancestries: ['dryadshroomling'] },
		]);
		expect(nimble().languageSpeakers.sylvanCant).toEqual(['dryadshroomling']);
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
	});
});

describe('findLanguageNameConflicts', () => {
	it('flags entries that share a name (case-insensitive)', () => {
		const conflicts = findLanguageNameConflicts([
			{ id: 'builtin:dwarvish', name: 'Celestial' },
			{ id: 'builtin:celestial', name: 'celestial' },
			{ id: 'builtin:common', name: 'Common' },
		]);

		expect(conflicts).toEqual(new Set(['builtin:dwarvish', 'builtin:celestial']));
	});

	it('returns an empty set when all names are unique', () => {
		const conflicts = findLanguageNameConflicts([
			{ id: 'a', name: 'Dwarvish' },
			{ id: 'b', name: 'Elvish' },
		]);

		expect(conflicts.size).toBe(0);
	});

	it('ignores blank names', () => {
		const conflicts = findLanguageNameConflicts([
			{ id: 'a', name: '   ' },
			{ id: 'b', name: '' },
		]);

		expect(conflicts.size).toBe(0);
	});
});

describe('ancestry language defaults', () => {
	const gnomeAncestry = {
		type: 'ancestry',
		name: 'Gnome',
		identifier: 'gnome',
		system: {
			rules: [
				{
					type: 'grantProficiency',
					proficiencyType: 'languages',
					values: ['dwarvish'],
					displayAs: 'Gnomish',
				},
			],
		},
	};

	function mockAncestrySources(items: unknown[]): void {
		(game as unknown as { items: unknown[]; packs: unknown[] }).items = items;
		(game as unknown as { items: unknown[]; packs: unknown[] }).packs = [];
	}

	it('seeds aliases and speakers from ancestry rules with zero GM setup', async () => {
		const { applyLanguageCustomizations, loadAncestryLanguageDefaults } = await loadModule();
		mockAncestrySources([gnomeAncestry]);

		await loadAncestryLanguageDefaults();
		applyLanguageCustomizations();

		expect(nimble().languageAlternateNames.dwarvish).toEqual([
			{ name: 'Gnomish', ancestries: ['gnome'] },
		]);
		expect(nimble().languageSpeakers.dwarvish).toEqual(['gnome']);
	});

	it('exposes the defaults to the editor', async () => {
		const { loadAncestryLanguageDefaults, getAncestryLanguageDefaults } = await loadModule();
		mockAncestrySources([gnomeAncestry]);

		await loadAncestryLanguageDefaults();

		expect(getAncestryLanguageDefaults().dwarvish).toEqual([
			{ ancestry: 'gnome', alias: 'Gnomish' },
		]);
	});

	it('marks Common as spoken by every ancestry (even non-language ones)', async () => {
		const {
			applyLanguageCustomizations,
			loadAncestryLanguageDefaults,
			getAncestryLanguageDefaults,
		} = await loadModule();
		const human = { type: 'ancestry', name: 'Human', identifier: 'human', system: { rules: [] } };
		mockAncestrySources([gnomeAncestry, human]);

		await loadAncestryLanguageDefaults();
		applyLanguageCustomizations();

		expect(getAncestryLanguageDefaults().common).toEqual([
			{ ancestry: 'gnome', alias: '' },
			{ ancestry: 'human', alias: '' },
		]);
		expect(nimble().languageSpeakers.common).toEqual(['gnome', 'human']);
	});

	it('lets a GM override the rule defaults (and removals stick)', async () => {
		const { applyLanguageCustomizations, loadAncestryLanguageDefaults } = await loadModule();
		mockAncestrySources([gnomeAncestry]);
		// GM removed the gnome speaker entirely.
		customizations.overrides = { dwarvish: { speakers: [] } };

		await loadAncestryLanguageDefaults();
		applyLanguageCustomizations();

		expect(nimble().languageSpeakers.dwarvish).toBeUndefined();
		expect(nimble().languageAlternateNames.dwarvish).toBeUndefined();
	});
});

describe('getLanguageName', () => {
	beforeEach(() => {
		nimble().languages = { ...PRISTINE_LANGUAGES };
		nimble().languageAlternateNames = {
			dwarvish: [{ name: 'Gnomish', ancestries: ['gnome'] }],
		};
	});

	it('annotates the canonical label with the alternate name for a matching ancestry', () => {
		expect(getLanguageName('dwarvish', { ancestryIdentifier: 'gnome' })).toBe(
			`${PRISTINE_LANGUAGES.dwarvish} (Gnomish)`,
		);
	});

	it('returns the canonical label for a non-matching ancestry', () => {
		expect(getLanguageName('dwarvish', { ancestryIdentifier: 'dwarf' })).toBe(
			PRISTINE_LANGUAGES.dwarvish,
		);
	});

	it('returns the canonical label when no ancestry is provided', () => {
		expect(getLanguageName('dwarvish')).toBe(PRISTINE_LANGUAGES.dwarvish);
	});

	it('falls back to the key for unknown languages', () => {
		expect(getLanguageName('madeUpKey', { ancestryIdentifier: 'gnome' })).toBe('madeUpKey');
	});
});
