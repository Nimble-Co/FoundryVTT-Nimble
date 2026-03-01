import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY,
	COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
	getCombatTrackerCenterActiveCardEnabled,
	getCombatTrackerPlayersCanExpandMonsterCards,
	isCombatTrackerCenterActiveCardSettingKey,
	isCombatTrackerPlayerMonsterExpansionSettingKey,
	registerCombatTrackerSettings,
	setCombatTrackerCenterActiveCardEnabled,
	setCombatTrackerPlayersCanExpandMonsterCards,
} from './combatTrackerSettings.js';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	register: ReturnType<typeof vi.fn>;
};

function createSettingsMock(): SettingsMock {
	return {
		get: vi.fn(),
		set: vi.fn().mockResolvedValue(undefined),
		register: vi.fn(),
	};
}

describe('combatTrackerSettings monster card expansion permission', () => {
	let settingsMock: SettingsMock;

	beforeEach(() => {
		settingsMock = createSettingsMock();
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
	});

	it('registers the player monster-card expansion setting', () => {
		registerCombatTrackerSettings();

		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Boolean,
				default: false,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Boolean,
				default: true,
			}),
		);
	});

	it('returns boolean values for player monster-card expansion permission', () => {
		settingsMock.get.mockReturnValueOnce(true);
		expect(getCombatTrackerPlayersCanExpandMonsterCards()).toBe(true);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerPlayersCanExpandMonsterCards()).toBe(false);
	});

	it('updates the player monster-card expansion permission setting', async () => {
		await setCombatTrackerPlayersCanExpandMonsterCards(true);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
			true,
		);
	});

	it('returns boolean values for center active card setting', () => {
		settingsMock.get.mockReturnValueOnce(true);
		expect(getCombatTrackerCenterActiveCardEnabled()).toBe(true);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerCenterActiveCardEnabled()).toBe(false);
	});

	it('updates the center active card setting', async () => {
		await setCombatTrackerCenterActiveCardEnabled(false);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY,
			false,
		);
	});

	it('recognizes qualified and unqualified setting keys', () => {
		expect(
			isCombatTrackerPlayerMonsterExpansionSettingKey(
				COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
			),
		).toBe(true);
		expect(
			isCombatTrackerPlayerMonsterExpansionSettingKey(
				`nimble.${COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerPlayerMonsterExpansionSettingKey('combatTrackerLocation')).toBe(false);
		expect(
			isCombatTrackerCenterActiveCardSettingKey(COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY),
		).toBe(true);
		expect(
			isCombatTrackerCenterActiveCardSettingKey(
				`nimble.${COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerCenterActiveCardSettingKey('combatTrackerLocation')).toBe(false);
	});
});
