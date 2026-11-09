import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

import {
	COLLAPSE_NPC_FEATURES_SETTING_KEY,
	OPEN_NPC_SHEETS_NARROW_SETTING_KEY,
	openNpcFeaturesCollapsed,
	openNpcSheetsNarrow,
	registerActorSheetSettings,
} from '../actorSheetSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	register: ReturnType<typeof vi.fn>;
	settings: { has: ReturnType<typeof vi.fn> };
};

describe('actorSheetSettings', () => {
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

	it('registers "Open NPC sheets narrow" for each user, off at the start, in Configure Settings', () => {
		registerActorSheetSettings();

		expect(settingsMock.register).toHaveBeenCalledWith(
			SYSTEM_ID,
			OPEN_NPC_SHEETS_NARROW_SETTING_KEY,
			expect.objectContaining({
				name: 'NIMBLE.settings.openNpcSheetsNarrow.name',
				hint: 'NIMBLE.settings.openNpcSheetsNarrow.hint',
				scope: 'client',
				config: true,
				type: Boolean,
				default: false,
			}),
		);
	});

	it('reads the setting of this user', () => {
		settingsMock.get.mockReturnValue(true);

		expect(openNpcSheetsNarrow()).toBe(true);
		expect(settingsMock.get).toHaveBeenCalledWith(SYSTEM_ID, OPEN_NPC_SHEETS_NARROW_SETTING_KEY);
	});

	it('is off before the setting is registered', () => {
		settingsMock.settings.has.mockReturnValue(false);

		expect(openNpcSheetsNarrow()).toBe(false);
		expect(settingsMock.get).not.toHaveBeenCalled();
	});

	it('registers "Collapse NPC features" for each user, off at the start, and reads it', () => {
		registerActorSheetSettings();
		settingsMock.get.mockReturnValue(true);

		expect(settingsMock.register).toHaveBeenCalledWith(
			SYSTEM_ID,
			COLLAPSE_NPC_FEATURES_SETTING_KEY,
			expect.objectContaining({
				name: 'NIMBLE.settings.collapseNpcFeatures.name',
				scope: 'client',
				config: true,
				default: false,
			}),
		);
		expect(openNpcFeaturesCollapsed()).toBe(true);
		expect(settingsMock.get).toHaveBeenCalledWith(SYSTEM_ID, COLLAPSE_NPC_FEATURES_SETTING_KEY);
	});
});
