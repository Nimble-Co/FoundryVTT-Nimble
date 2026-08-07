import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	AUTOMATION_SETTING_KEYS,
	LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY,
} from './automationSettings.js';
import { registerAutomationSettings } from './registerAutomationSettings.js';

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

vi.mock('#view/settings/AutomationSettingsDialog.svelte', () => ({ default: {} }));

type SettingsMock = {
	register: ReturnType<typeof vi.fn>;
	registerMenu: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
	storage: { get: ReturnType<typeof vi.fn> };
};

type RegisteredSettingConfig = { default?: boolean };

/**
 * Installs a settings mock simulating a world database. `worldStorageContents`
 * of undefined simulates `game.settings.storage.get('world')` itself returning
 * undefined; `legacyStoredValue` is what a registration-time `get` of the
 * legacy key yields (the stored value, or the registered default of false).
 */
function setupSettingsMock(params: {
	worldStorageContents: Array<{ key: string }> | undefined;
	legacyStoredValue: boolean;
}): SettingsMock {
	const settingsMock: SettingsMock = {
		register: vi.fn(),
		registerMenu: vi.fn(),
		get: vi.fn((_namespace: string, key: string) => {
			if (key === LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY) return params.legacyStoredValue;
			return undefined;
		}),
		storage: {
			get: vi.fn((scope: string) =>
				scope === 'world' && params.worldStorageContents !== undefined
					? { contents: params.worldStorageContents }
					: undefined,
			),
		},
	};
	(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	return settingsMock;
}

function legacyStorageDocument(): { key: string } {
	return { key: `${SYSTEM_ID}.${LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY}` };
}

function getRegisteredConfig(
	settingsMock: SettingsMock,
	settingKey: string,
): RegisteredSettingConfig | undefined {
	const call = settingsMock.register.mock.calls.find(([, key]) => key === settingKey);
	return call?.[2] as RegisteredSettingConfig | undefined;
}

function expectOtherTogglesDefaultTrue(settingsMock: SettingsMock): void {
	const otherSettingKeys = Object.values(AUTOMATION_SETTING_KEYS).filter(
		(settingKey) => settingKey !== AUTOMATION_SETTING_KEYS.applyRuleEffects,
	);
	expect(otherSettingKeys).toHaveLength(7);
	for (const settingKey of otherSettingKeys) {
		expect(getRegisteredConfig(settingsMock, settingKey)).toMatchObject({ default: true });
	}
}

describe('registerAutomationSettings', () => {
	it('registers every automation toggle and the settings submenu under the system namespace', () => {
		const settingsMock = setupSettingsMock({
			worldStorageContents: [],
			legacyStoredValue: false,
		});

		registerAutomationSettings();

		// The legacy setting plus the 8 automation family toggles.
		expect(settingsMock.register).toHaveBeenCalledTimes(9);
		for (const [namespace] of settingsMock.register.mock.calls) {
			expect(namespace).toBe(SYSTEM_ID);
		}
		expect(
			getRegisteredConfig(settingsMock, LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY),
		).toBeDefined();
		expect(settingsMock.registerMenu).toHaveBeenCalledTimes(1);
		expect(settingsMock.registerMenu).toHaveBeenCalledWith(
			SYSTEM_ID,
			'automationMenu',
			expect.objectContaining({ restricted: true }),
		);
	});

	it('seeds applyRuleEffects with default false when the legacy setting was stored as false', () => {
		const settingsMock = setupSettingsMock({
			worldStorageContents: [legacyStorageDocument()],
			legacyStoredValue: false,
		});

		registerAutomationSettings();

		expect(
			getRegisteredConfig(settingsMock, AUTOMATION_SETTING_KEYS.applyRuleEffects),
		).toMatchObject({ default: false });
		expectOtherTogglesDefaultTrue(settingsMock);
	});

	it('seeds applyRuleEffects with default true when the legacy setting was stored as true', () => {
		const settingsMock = setupSettingsMock({
			worldStorageContents: [legacyStorageDocument()],
			legacyStoredValue: true,
		});

		registerAutomationSettings();

		expect(
			getRegisteredConfig(settingsMock, AUTOMATION_SETTING_KEYS.applyRuleEffects),
		).toMatchObject({ default: true });
		expectOtherTogglesDefaultTrue(settingsMock);
	});

	it('seeds applyRuleEffects with default true for a fresh world with no stored legacy setting', () => {
		const settingsMock = setupSettingsMock({
			worldStorageContents: [{ key: `${SYSTEM_ID}.someOtherSetting` }],
			legacyStoredValue: false,
		});

		registerAutomationSettings();

		expect(
			getRegisteredConfig(settingsMock, AUTOMATION_SETTING_KEYS.applyRuleEffects),
		).toMatchObject({ default: true });
		expectOtherTogglesDefaultTrue(settingsMock);
	});

	it('does not throw and defaults applyRuleEffects to true when the world storage collection is missing', () => {
		const settingsMock = setupSettingsMock({
			worldStorageContents: undefined,
			legacyStoredValue: false,
		});

		expect(() => registerAutomationSettings()).not.toThrow();
		expect(
			getRegisteredConfig(settingsMock, AUTOMATION_SETTING_KEYS.applyRuleEffects),
		).toMatchObject({ default: true });
		expectOtherTogglesDefaultTrue(settingsMock);
	});
});
