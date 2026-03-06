import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY,
	COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY,
	COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY,
	COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY,
	COMBAT_TRACKER_ENABLED_SETTING_KEY,
	COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY,
	COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
	COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY,
	COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY,
	CURRENT_TURN_ANIMATION_SETTING_KEYS,
	canCurrentUserDisplayNonPlayerHitpointsOnCards,
	getCombatTrackerActionDiceColor,
	getCombatTrackerCenterActiveCardEnabled,
	getCombatTrackerCtBadgeSizeLevel,
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtEnabled,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerNonPlayerHitpointPermissionConfig,
	getCombatTrackerPlayersCanExpandMonsterCards,
	getCombatTrackerUseActionDice,
	getCurrentTurnAnimationSettings,
	isCombatTrackerActionDiceColorSettingKey,
	isCombatTrackerBadgeSizeLevelSettingKey,
	isCombatTrackerCardSizeLevelSettingKey,
	isCombatTrackerCenterActiveCardSettingKey,
	isCombatTrackerEnabledSettingKey,
	isCombatTrackerNonPlayerHitpointPermissionSettingKey,
	isCombatTrackerPlayerMonsterExpansionSettingKey,
	isCombatTrackerUseActionDiceSettingKey,
	isCombatTrackerWidthLevelSettingKey,
	registerCombatTrackerSettings,
	setCombatTrackerActionDiceColor,
	setCombatTrackerCenterActiveCardEnabled,
	setCombatTrackerCtBadgeSizeLevel,
	setCombatTrackerCtCardSizeLevel,
	setCombatTrackerCtEnabled,
	setCombatTrackerCtWidthLevel,
	setCombatTrackerNonPlayerHitpointPermissionConfig,
	setCombatTrackerPlayersCanExpandMonsterCards,
	setCombatTrackerUseActionDice,
	setCurrentTurnAnimationSetting,
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
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_ENABLED_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: true,
				type: Boolean,
				default: true,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Number,
				default: 2,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Number,
				default: 3,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Number,
				default: 1,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Boolean,
				default: false,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Object,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY,
			expect.objectContaining({
				scope: 'client',
				config: false,
				type: String,
				default: '#ffffff',
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseAnimation,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: Boolean,
				default: true,
			}),
		);
		expect(settingsMock.register).toHaveBeenCalledWith(
			'nimble',
			CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerColor,
			expect.objectContaining({
				scope: 'world',
				config: false,
				type: String,
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

	it('returns boolean values for CT enabled setting', () => {
		settingsMock.get.mockReturnValueOnce(true);
		expect(getCombatTrackerCtEnabled()).toBe(true);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerCtEnabled()).toBe(false);
	});

	it('updates the CT enabled setting', async () => {
		await setCombatTrackerCtEnabled(false);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_ENABLED_SETTING_KEY,
			false,
		);
	});

	it('returns normalized values for CT width level setting', () => {
		settingsMock.get.mockReturnValueOnce(6);
		expect(getCombatTrackerCtWidthLevel()).toBe(6);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerCtWidthLevel()).toBe(1);

		settingsMock.get.mockReturnValueOnce(9);
		expect(getCombatTrackerCtWidthLevel()).toBe(6);
	});

	it('updates the CT width level setting with snapped values', async () => {
		await setCombatTrackerCtWidthLevel(3.4);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY,
			3,
		);
	});

	it('returns normalized values for CT card size level setting', () => {
		settingsMock.get.mockReturnValueOnce(6);
		expect(getCombatTrackerCtCardSizeLevel()).toBe(6);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerCtCardSizeLevel()).toBe(1);

		settingsMock.get.mockReturnValueOnce(9);
		expect(getCombatTrackerCtCardSizeLevel()).toBe(6);
	});

	it('updates the CT card size level setting with snapped values', async () => {
		await setCombatTrackerCtCardSizeLevel(4.6);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY,
			5,
		);
	});

	it('returns normalized values for CT badge size level setting', () => {
		settingsMock.get.mockReturnValueOnce(6);
		expect(getCombatTrackerCtBadgeSizeLevel()).toBe(6);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerCtBadgeSizeLevel()).toBe(1);

		settingsMock.get.mockReturnValueOnce(9);
		expect(getCombatTrackerCtBadgeSizeLevel()).toBe(6);
	});

	it('updates the CT badge size level setting with snapped values', async () => {
		await setCombatTrackerCtBadgeSizeLevel(4.6);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY,
			5,
		);
	});

	it('returns boolean values for CT use action dice setting', () => {
		settingsMock.get.mockReturnValueOnce(true);
		expect(getCombatTrackerUseActionDice()).toBe(true);

		settingsMock.get.mockReturnValueOnce(0);
		expect(getCombatTrackerUseActionDice()).toBe(false);
	});

	it('updates the CT use action dice setting', async () => {
		await setCombatTrackerUseActionDice(true);

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY,
			true,
		);
	});

	it('returns normalized permission config for non-player hitpoints', () => {
		settingsMock.get.mockReturnValueOnce({
			player: 1,
			trusted: 0,
			assistant: true,
			gamemaster: false,
		});

		expect(getCombatTrackerNonPlayerHitpointPermissionConfig()).toEqual({
			player: true,
			trusted: false,
			assistant: true,
			gamemaster: false,
		});
	});

	it('updates non-player hitpoint permission config setting', async () => {
		await setCombatTrackerNonPlayerHitpointPermissionConfig({
			player: true,
			trusted: true,
			assistant: false,
			gamemaster: true,
		});

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY,
			{
				player: true,
				trusted: true,
				assistant: false,
				gamemaster: true,
			},
		);
	});

	it('resolves non-player hitpoint visibility from user role', () => {
		settingsMock.get.mockReturnValueOnce({
			player: false,
			trusted: false,
			assistant: true,
			gamemaster: true,
		});
		expect(canCurrentUserDisplayNonPlayerHitpointsOnCards(1)).toBe(false);

		settingsMock.get.mockReturnValueOnce({
			player: false,
			trusted: false,
			assistant: true,
			gamemaster: true,
		});
		expect(canCurrentUserDisplayNonPlayerHitpointsOnCards(3)).toBe(true);
	});

	it('returns normalized values for CT action dice color setting', () => {
		settingsMock.get.mockReturnValueOnce('#ABC');
		expect(getCombatTrackerActionDiceColor()).toBe('#aabbcc');

		settingsMock.get.mockReturnValueOnce('not-a-color');
		expect(getCombatTrackerActionDiceColor()).toBe('#ffffff');
	});

	it('updates the CT action dice color setting with normalized values', async () => {
		await setCombatTrackerActionDiceColor('#F0A');

		expect(settingsMock.set).toHaveBeenCalledWith(
			'nimble',
			COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY,
			'#ff00aa',
		);
	});

	it('returns normalized values for legacy current-turn animation settings', () => {
		settingsMock.get.mockImplementation((_namespace: string, key: string) => {
			switch (key) {
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseAnimation:
					return 1;
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseSpeed:
					return 101;
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlow:
					return true;
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor:
					return '#abc';
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowSize:
					return -5;
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawler:
					return false;
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerColor:
					return 'bad-color';
				case CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize:
					return 67.8;
				default:
					return undefined;
			}
		});

		expect(getCurrentTurnAnimationSettings()).toEqual({
			pulseAnimation: true,
			pulseSpeed: 100,
			borderGlow: true,
			borderGlowColor: '#AABBCC',
			borderGlowSize: 0,
			edgeCrawler: false,
			edgeCrawlerColor: '#FFFFFF',
			edgeCrawlerSize: 68,
		});
	});

	it('updates legacy current-turn animation settings with normalized values', async () => {
		await setCurrentTurnAnimationSetting(
			CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor,
			'#0f0',
		);
		await setCurrentTurnAnimationSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize, 110);

		expect(settingsMock.set).toHaveBeenNthCalledWith(
			1,
			'nimble',
			CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor,
			'#00FF00',
		);
		expect(settingsMock.set).toHaveBeenNthCalledWith(
			2,
			'nimble',
			CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize,
			100,
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
		expect(isCombatTrackerEnabledSettingKey(COMBAT_TRACKER_ENABLED_SETTING_KEY)).toBe(true);
		expect(isCombatTrackerEnabledSettingKey(`nimble.${COMBAT_TRACKER_ENABLED_SETTING_KEY}`)).toBe(
			true,
		);
		expect(isCombatTrackerEnabledSettingKey('combatTrackerLocation')).toBe(false);
		expect(isCombatTrackerWidthLevelSettingKey(COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY)).toBe(true);
		expect(
			isCombatTrackerWidthLevelSettingKey(`nimble.${COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY}`),
		).toBe(true);
		expect(isCombatTrackerWidthLevelSettingKey('combatTrackerLocation')).toBe(false);
		expect(isCombatTrackerCardSizeLevelSettingKey(COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY)).toBe(
			true,
		);
		expect(
			isCombatTrackerCardSizeLevelSettingKey(
				`nimble.${COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerCardSizeLevelSettingKey('combatTrackerLocation')).toBe(false);
		expect(
			isCombatTrackerBadgeSizeLevelSettingKey(COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY),
		).toBe(true);
		expect(
			isCombatTrackerBadgeSizeLevelSettingKey(
				`nimble.${COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerBadgeSizeLevelSettingKey('combatTrackerLocation')).toBe(false);
		expect(isCombatTrackerUseActionDiceSettingKey(COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY)).toBe(
			true,
		);
		expect(
			isCombatTrackerUseActionDiceSettingKey(
				`nimble.${COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerUseActionDiceSettingKey('combatTrackerLocation')).toBe(false);
		expect(
			isCombatTrackerNonPlayerHitpointPermissionSettingKey(
				COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY,
			),
		).toBe(true);
		expect(
			isCombatTrackerNonPlayerHitpointPermissionSettingKey(
				`nimble.${COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerNonPlayerHitpointPermissionSettingKey('combatTrackerLocation')).toBe(
			false,
		);
		expect(
			isCombatTrackerActionDiceColorSettingKey(COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY),
		).toBe(true);
		expect(
			isCombatTrackerActionDiceColorSettingKey(
				`nimble.${COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY}`,
			),
		).toBe(true);
		expect(isCombatTrackerActionDiceColorSettingKey('combatTrackerLocation')).toBe(false);
	});
});
