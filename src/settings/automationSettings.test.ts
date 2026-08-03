import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AUTOMATION_SETTING_KEYS,
	isActionTrackingAutomationEnabled,
	isChatNotificationsAutomationEnabled,
	isCombatConvenienceAutomationEnabled,
	isDerivedConditionsAutomationEnabled,
	isHealthStateSyncAutomationEnabled,
	isResourceRecoveryAutomationEnabled,
	isResourceSpendingAutomationEnabled,
	isRuleAutomationEnabled,
	resolveLegacyAutoApplyDefault,
	setAutomationToggle,
} from './automationSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
};

const GETTERS_BY_KEY: Array<[string, () => boolean]> = [
	[AUTOMATION_SETTING_KEYS.applyRuleEffects, isRuleAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.derivedConditions, isDerivedConditionsAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.resourceRecovery, isResourceRecoveryAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.resourceSpending, isResourceSpendingAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.actionTracking, isActionTrackingAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.healthStateSync, isHealthStateSyncAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.combatConvenience, isCombatConvenienceAutomationEnabled],
	[AUTOMATION_SETTING_KEYS.chatNotifications, isChatNotificationsAutomationEnabled],
];

describe('automationSettings', () => {
	let settingsMock: SettingsMock;

	beforeEach(() => {
		settingsMock = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) };
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	});

	describe('toggle getters', () => {
		it.each(GETTERS_BY_KEY)('%s reads its stored value', (key, getter) => {
			settingsMock.get.mockImplementation((_namespace, requestedKey) => requestedKey !== key);
			expect(getter()).toBe(false);

			settingsMock.get.mockReturnValue(true);
			expect(getter()).toBe(true);
		});

		it.each(GETTERS_BY_KEY)('%s fails open when the settings read throws', (_key, getter) => {
			settingsMock.get.mockImplementation(() => {
				throw new Error('not a registered setting');
			});
			expect(getter()).toBe(true);
		});

		it.each(GETTERS_BY_KEY)('%s fails open when settings are unavailable', (_key, getter) => {
			(game as unknown as { settings: undefined }).settings = undefined;
			expect(getter()).toBe(true);
		});

		it.each(GETTERS_BY_KEY)('%s fails open when the read returns undefined', (_key, getter) => {
			settingsMock.get.mockReturnValue(undefined);
			expect(getter()).toBe(true);
		});
	});

	describe('setAutomationToggle', () => {
		it('persists the value under the requested key', async () => {
			await setAutomationToggle(AUTOMATION_SETTING_KEYS.resourceSpending, false);
			expect(settingsMock.set).toHaveBeenCalledWith(
				expect.any(String),
				AUTOMATION_SETTING_KEYS.resourceSpending,
				false,
			);
		});
	});

	describe('resolveLegacyAutoApplyDefault', () => {
		it('keeps an explicitly stored legacy value', () => {
			expect(resolveLegacyAutoApplyDefault(true, false)).toBe(false);
			expect(resolveLegacyAutoApplyDefault(true, true)).toBe(true);
		});

		it('defaults to enabled when no legacy value was stored', () => {
			expect(resolveLegacyAutoApplyDefault(false, false)).toBe(true);
			expect(resolveLegacyAutoApplyDefault(false, true)).toBe(true);
		});
	});
});
