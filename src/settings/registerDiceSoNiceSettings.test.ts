import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	DSN_PRIMARY_DIE_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY,
} from './diceSoNiceSettings.js';
import { registerDiceSoNiceSettings } from './registerDiceSoNiceSettings.js';

// The settings menu class extends an ApplicationV2-based dialog and pulls in a
// Svelte component; neither is exercised by registration itself, so both are
// replaced with inert stand-ins to keep this suite node-safe.
vi.mock('#documents/dialogs/GenericDialog.svelte.js', () => ({
	default: class GenericDialogMock {
		async render(): Promise<this> {
			return this;
		}
	},
}));

vi.mock('#view/settings/DiceSoNiceSettingsDialog.svelte', () => ({ default: {} }));

type SettingsMock = {
	register: ReturnType<typeof vi.fn>;
	registerMenu: ReturnType<typeof vi.fn>;
};

type RegisteredSettingConfig = { scope?: string; config?: boolean };

function setupSettingsMock(): SettingsMock {
	const settingsMock: SettingsMock = { register: vi.fn(), registerMenu: vi.fn() };
	(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	return settingsMock;
}

function getRegisteredConfig(
	settingsMock: SettingsMock,
	settingKey: string,
): RegisteredSettingConfig | undefined {
	const call = settingsMock.register.mock.calls.find(([, key]) => key === settingKey);
	return call?.[2] as RegisteredSettingConfig | undefined;
}

describe('registerDiceSoNiceSettings', () => {
	let settingsMock: SettingsMock;

	beforeEach(() => {
		settingsMock = setupSettingsMock();
		registerDiceSoNiceSettings();
	});

	it('hides every primary die setting from the flat settings list', () => {
		const settingKeys = [
			DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY,
			DSN_PRIMARY_DIE_COLOR_SETTING_KEY,
			DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY,
		];

		expect(settingsMock.register).toHaveBeenCalledTimes(settingKeys.length);
		for (const settingKey of settingKeys) {
			expect(getRegisteredConfig(settingsMock, settingKey)).toMatchObject({
				scope: 'user',
				config: false,
			});
		}
	});

	it('registers an unrestricted submenu so every player can reach their own settings', () => {
		expect(settingsMock.registerMenu).toHaveBeenCalledTimes(1);
		expect(settingsMock.registerMenu).toHaveBeenCalledWith(
			SYSTEM_ID,
			'diceSoNiceMenu',
			expect.objectContaining({ restricted: false }),
		);
	});
});
