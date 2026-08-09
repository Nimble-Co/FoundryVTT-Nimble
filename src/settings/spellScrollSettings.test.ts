import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

import {
	INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY,
	shouldIncludeSpellDescriptionOnScrolls,
} from './spellScrollSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	settings: { has: ReturnType<typeof vi.fn> };
};

const QUALIFIED_KEY = `${SYSTEM_ID}.${INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY}`;

describe('shouldIncludeSpellDescriptionOnScrolls', () => {
	let settingsMock: SettingsMock;
	let originalSettings: unknown;

	beforeEach(() => {
		originalSettings = (game as unknown as { settings: unknown }).settings;
		settingsMock = { get: vi.fn(), settings: { has: vi.fn().mockReturnValue(true) } };
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	});

	afterEach(() => {
		(game as unknown as { settings: unknown }).settings = originalSettings;
	});

	it('reads the stored value once registered', () => {
		settingsMock.get.mockReturnValue(false);

		expect(shouldIncludeSpellDescriptionOnScrolls()).toBe(false);
		expect(settingsMock.get).toHaveBeenCalledWith(
			SYSTEM_ID,
			INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY,
		);
	});

	it('coerces a truthy stored value to true', () => {
		settingsMock.get.mockReturnValue('yes');

		expect(shouldIncludeSpellDescriptionOnScrolls()).toBe(true);
	});

	it('coerces a falsy stored value to false', () => {
		settingsMock.get.mockReturnValue(undefined);

		expect(shouldIncludeSpellDescriptionOnScrolls()).toBe(false);
	});

	it('defaults to true before the setting is registered, without reading it', () => {
		settingsMock.settings.has.mockReturnValue(false);

		expect(shouldIncludeSpellDescriptionOnScrolls()).toBe(true);
		expect(settingsMock.settings.has).toHaveBeenCalledWith(QUALIFIED_KEY);
		expect(settingsMock.get).not.toHaveBeenCalled();
	});

	it('defaults to true when settings are unavailable entirely', () => {
		(game as unknown as { settings: undefined }).settings = undefined;

		expect(shouldIncludeSpellDescriptionOnScrolls()).toBe(true);
	});
});
