import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

import {
	MULTICLASSING_SETTING_KEY,
	multiclassingEnabled,
	registerMulticlassSettings,
} from '../multiclassSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	register: ReturnType<typeof vi.fn>;
	settings: { has: ReturnType<typeof vi.fn> };
};

describe('multiclassSettings', () => {
	let settingsMock: SettingsMock;
	let originalSettings: unknown;

	beforeEach(() => {
		originalSettings = (game as unknown as { settings: unknown }).settings;
		settingsMock = {
			get: vi.fn(),
			register: vi.fn(),
			settings: { has: vi.fn().mockReturnValue(true) },
		};
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	});

	afterEach(() => {
		(game as unknown as { settings: unknown }).settings = originalSettings;
	});

	it('registers a world setting that starts off', () => {
		registerMulticlassSettings();

		expect(settingsMock.register).toHaveBeenCalledWith(
			SYSTEM_ID,
			MULTICLASSING_SETTING_KEY,
			expect.objectContaining({
				name: 'NIMBLE.settings.multiclassing.name',
				hint: 'NIMBLE.settings.multiclassing.hint',
				scope: 'world',
				config: true,
				type: Boolean,
				default: false,
			}),
		);
	});

	it('reads the world setting', () => {
		settingsMock.get.mockReturnValue(true);

		expect(multiclassingEnabled()).toBe(true);
		expect(settingsMock.get).toHaveBeenCalledWith(SYSTEM_ID, MULTICLASSING_SETTING_KEY);
	});

	it('is off before the setting is registered', () => {
		settingsMock.settings.has.mockReturnValue(false);

		expect(multiclassingEnabled()).toBe(false);
		expect(settingsMock.get).not.toHaveBeenCalled();
	});
});
