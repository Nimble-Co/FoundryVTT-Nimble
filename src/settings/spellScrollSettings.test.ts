import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

import {
	INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY,
	registerSpellScrollSettings,
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

describe('registerSpellScrollSettings', () => {
	let originalSettings: unknown;
	let register: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		originalSettings = (game as unknown as { settings: unknown }).settings;
		register = vi.fn();
		(game as unknown as { settings: unknown }).settings = { register };
	});

	afterEach(() => {
		(game as unknown as { settings: unknown }).settings = originalSettings;
	});

	it('registers the description toggle under the system namespace', () => {
		registerSpellScrollSettings();

		expect(register).toHaveBeenCalledTimes(1);
		expect(register.mock.calls[0][0]).toBe(SYSTEM_ID);
		expect(register.mock.calls[0][1]).toBe(INCLUDE_SPELL_DESCRIPTION_ON_SCROLLS_SETTING_KEY);
	});

	// World scope is load-bearing: the value is baked into the created document, so
	// a client-scope toggle would give two players scribing the same spell two
	// different items.
	it('registers it world-scoped, configurable, and defaulted on', () => {
		registerSpellScrollSettings();

		expect(register.mock.calls[0][2]).toMatchObject({
			scope: 'world',
			config: true,
			type: Boolean,
			default: true,
		});
	});
});
