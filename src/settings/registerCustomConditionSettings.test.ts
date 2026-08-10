import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { CUSTOM_CONDITIONS_SETTING_KEY } from './customConditionSettings.js';
import { registerCustomConditionSettings } from './registerCustomConditionSettings.js';

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

vi.mock('#view/settings/CustomConditionsEditor.svelte', () => ({ default: {} }));

type SettingsMock = {
	register: ReturnType<typeof vi.fn>;
	registerMenu: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
};

type RegisteredSettingConfig = {
	scope?: string;
	config?: boolean;
	default?: unknown;
	onChange?: () => void;
};

const BUILT_IN_CONDITIONS = { blinded: 'Blinded' };

function setupSettingsMock(storedConditions: unknown[]): SettingsMock {
	const settingsMock: SettingsMock = {
		register: vi.fn(),
		registerMenu: vi.fn(),
		get: vi.fn().mockReturnValue(storedConditions),
	};
	(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	return settingsMock;
}

function registeredConfig(settingsMock: SettingsMock): RegisteredSettingConfig {
	const call = settingsMock.register.mock.calls.find(
		([, key]) => key === CUSTOM_CONDITIONS_SETTING_KEY,
	);
	return call?.[2] as RegisteredSettingConfig;
}

describe('registerCustomConditionSettings', () => {
	beforeEach(() => {
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
			conditions: { ...BUILT_IN_CONDITIONS },
			conditionDescriptions: {},
			conditionDefaultImages: {},
		};
	});

	it('registers a GM-only world setting and its submenu under the system namespace', () => {
		const settingsMock = setupSettingsMock([]);

		registerCustomConditionSettings();

		expect(settingsMock.register).toHaveBeenCalledWith(
			SYSTEM_ID,
			CUSTOM_CONDITIONS_SETTING_KEY,
			expect.objectContaining({ scope: 'world', config: false, default: [] }),
		);
		expect(settingsMock.registerMenu).toHaveBeenCalledWith(
			SYSTEM_ID,
			'customConditionsMenu',
			expect.objectContaining({ restricted: true }),
		);
	});

	it('merges stored conditions into the config at registration time', () => {
		setupSettingsMock([{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' }]);

		registerCustomConditionSettings();

		expect((CONFIG.NIMBLE as unknown as { conditions: Record<string, string> }).conditions).toEqual(
			{ blinded: 'Blinded', hexed: 'Hexed' },
		);
	});

	it('republishes the status effects snapshot when the setting changes', () => {
		const settingsMock = setupSettingsMock([]);
		registerCustomConditionSettings();

		const calls: string[] = [];
		(game as unknown as { nimble: { conditions: object } }).nimble = {
			conditions: {
				initialize: vi.fn(() => calls.push('initialize')),
				configureStatusEffects: vi.fn(() => calls.push('configureStatusEffects')),
			},
		};

		settingsMock.get.mockReturnValue([{ id: 'hexed', name: 'Hexed' }]);
		registeredConfig(settingsMock).onChange?.();

		// The manager reads CONFIG, so the merge has to land before it rebuilds, and the
		// snapshot has to be republished afterwards or the token HUD keeps the stale list.
		expect((CONFIG.NIMBLE as unknown as { conditions: Record<string, string> }).conditions).toEqual(
			{ blinded: 'Blinded', hexed: 'Hexed' },
		);
		expect(calls).toEqual(['initialize', 'configureStatusEffects']);
	});
});
