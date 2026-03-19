import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY,
	COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY,
	COMBAT_TRACKER_ENABLED_SETTING_KEY,
	COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY,
	COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY,
	COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY,
	COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
	COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY,
	COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY,
	COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY,
	CURRENT_TURN_ANIMATION_SETTING_KEYS,
	getCombatTrackerActionDiceColor,
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtEnabled,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerNonPlayerHpBarEnabled,
	getCombatTrackerNonPlayerHpBarTextMode,
	getCombatTrackerPlayerHpBarTextMode,
	getCombatTrackerPlayersCanExpandMonsterCards,
	getCombatTrackerReactionColor,
	getCombatTrackerResourceDrawerHoverEnabled,
	getCurrentTurnAnimationSettings,
	isCombatTrackerActionDiceColorSettingKey,
	isCombatTrackerCardSizeLevelSettingKey,
	isCombatTrackerEnabledSettingKey,
	isCombatTrackerNonPlayerHpBarEnabledSettingKey,
	isCombatTrackerNonPlayerHpBarTextModeSettingKey,
	isCombatTrackerPlayerHpBarTextModeSettingKey,
	isCombatTrackerPlayerMonsterExpansionSettingKey,
	isCombatTrackerReactionColorSettingKey,
	isCombatTrackerResourceDrawerHoverSettingKey,
	isCombatTrackerWidthLevelSettingKey,
	normalizeHexColor,
	registerCombatTrackerSettings,
	setCombatTrackerActionDiceColor,
	setCombatTrackerCtCardSizeLevel,
	setCombatTrackerCtEnabled,
	setCombatTrackerCtWidthLevel,
	setCombatTrackerNonPlayerHpBarEnabled,
	setCombatTrackerNonPlayerHpBarTextMode,
	setCombatTrackerPlayerHpBarTextMode,
	setCombatTrackerPlayersCanExpandMonsterCards,
	setCombatTrackerReactionColor,
	setCombatTrackerResourceDrawerHoverEnabled,
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

describe('combatTrackerSettings', () => {
	let settingsMock: SettingsMock;

	beforeEach(() => {
		settingsMock = createSettingsMock();
		(game as unknown as { settings: SettingsMock }).settings = settingsMock;
		document.documentElement.style.removeProperty('--nimble-ct-action-die-color');
		document.documentElement.style.removeProperty('--nimble-ct-reaction-color');
	});

	it('registers the simplified CT settings and omits removed settings', () => {
		settingsMock.get.mockReturnValue('#fff');

		registerCombatTrackerSettings();

		const registeredKeys = settingsMock.register.mock.calls.map((call) => call[1]);
		const registeredOptions = Object.fromEntries(
			settingsMock.register.mock.calls.map((call) => [call[1], call[2]]),
		);
		expect(registeredKeys).toEqual(
			expect.arrayContaining([
				COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
				COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY,
				COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY,
				COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY,
				COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY,
				COMBAT_TRACKER_ENABLED_SETTING_KEY,
				COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY,
				COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY,
				COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY,
				COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY,
				CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseAnimation,
			]),
		);
		expect(registeredKeys).not.toContain('combatTrackerCenterActiveCard');
		expect(registeredKeys).not.toContain('combatTrackerCtBadgeSizeLevel');
		expect(registeredKeys).not.toContain('combatTrackerCtUseActionDice');
		expect(registeredKeys).not.toContain('combatTrackerNonPlayerHitpointPermission');
		expect(registeredKeys).not.toContain('combatTrackerVisibilityPermission');
		expect(registeredOptions[COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: true,
		});
		expect(registeredOptions[COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: 'none',
		});
		expect(registeredOptions[COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: 10,
		});
		expect(registeredOptions[COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: 5,
		});
		expect(registeredOptions[COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY]).toMatchObject({
			scope: 'world',
			default: false,
		});
		expect(registeredOptions[COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY]).toMatchObject(
			{
				scope: 'world',
				default: 'none',
			},
		);
		expect(registeredOptions[COMBAT_TRACKER_ENABLED_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: true,
		});
		expect(registeredOptions[COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: '#ffffff',
		});
		expect(registeredOptions[COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY]).toMatchObject({
			scope: 'client',
			default: '#4fc3f7',
		});
	});

	it('normalizes ct world settings', () => {
		settingsMock.get
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce('percentage')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce('invalid')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(11)
			.mockReturnValueOnce(0);

		expect(getCombatTrackerPlayersCanExpandMonsterCards()).toBe(true);
		expect(getCombatTrackerResourceDrawerHoverEnabled()).toBe(false);
		expect(getCombatTrackerPlayerHpBarTextMode()).toBe('percentage');
		expect(getCombatTrackerNonPlayerHpBarEnabled()).toBe(true);
		expect(getCombatTrackerNonPlayerHpBarTextMode()).toBe('none');
		expect(getCombatTrackerCtEnabled()).toBe(false);
		expect(getCombatTrackerCtWidthLevel()).toBe(1);
		expect(getCombatTrackerCtCardSizeLevel()).toBe(10);
	});

	it('normalizes action and reaction colors', () => {
		settingsMock.get.mockReturnValueOnce('#ABC').mockReturnValueOnce('bad-color');

		expect(getCombatTrackerActionDiceColor()).toBe('#aabbcc');
		expect(getCombatTrackerReactionColor()).toBe('#ffffff');
	});

	it('persists simplified ct settings', async () => {
		await setCombatTrackerPlayersCanExpandMonsterCards(true);
		await setCombatTrackerResourceDrawerHoverEnabled(false);
		await setCombatTrackerPlayerHpBarTextMode('hpState');
		await setCombatTrackerNonPlayerHpBarEnabled(false);
		await setCombatTrackerNonPlayerHpBarTextMode('percentage');
		await setCombatTrackerCtEnabled(false);
		await setCombatTrackerCtWidthLevel(3.4);
		await setCombatTrackerCtCardSizeLevel(4.6);

		expect(settingsMock.set.mock.calls).toEqual(
			expect.arrayContaining([
				['nimble', COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY, true],
				['nimble', COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY, false],
				['nimble', COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY, 'hpState'],
				['nimble', COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY, false],
				['nimble', COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY, 'percentage'],
				['nimble', COMBAT_TRACKER_ENABLED_SETTING_KEY, false],
				['nimble', COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY, 3],
				['nimble', COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY, 5],
			]),
		);
	});

	it('persists action and reaction colors and applies css variables', async () => {
		await setCombatTrackerActionDiceColor('#F0A');
		await setCombatTrackerReactionColor('#4FC3F7');

		expect(settingsMock.set.mock.calls).toEqual(
			expect.arrayContaining([
				['nimble', COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY, '#ff00aa'],
				['nimble', COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY, '#4fc3f7'],
			]),
		);
		expect(document.documentElement.style.getPropertyValue('--nimble-ct-action-die-color')).toBe(
			'#ff00aa',
		);
		expect(document.documentElement.style.getPropertyValue('--nimble-ct-reaction-color')).toBe(
			'#4fc3f7',
		);
	});

	it('normalizes legacy current-turn animation settings', () => {
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

	it('persists legacy current-turn animation settings with normalization', async () => {
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

	it('matches setting key predicates', () => {
		expect(
			isCombatTrackerPlayerMonsterExpansionSettingKey(
				COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY,
			),
		).toBe(true);
		expect(
			isCombatTrackerResourceDrawerHoverSettingKey(
				`nimble.${COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY}`,
			),
		).toBe(true);
		expect(
			isCombatTrackerPlayerHpBarTextModeSettingKey(
				COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY,
			),
		).toBe(true);
		expect(
			isCombatTrackerNonPlayerHpBarEnabledSettingKey(
				COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY,
			),
		).toBe(true);
		expect(
			isCombatTrackerNonPlayerHpBarTextModeSettingKey(
				COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY,
			),
		).toBe(true);
		expect(isCombatTrackerEnabledSettingKey(COMBAT_TRACKER_ENABLED_SETTING_KEY)).toBe(true);
		expect(isCombatTrackerWidthLevelSettingKey(COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY)).toBe(true);
		expect(isCombatTrackerCardSizeLevelSettingKey(COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY)).toBe(
			true,
		);
		expect(
			isCombatTrackerActionDiceColorSettingKey(COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY),
		).toBe(true);
		expect(isCombatTrackerReactionColorSettingKey(COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY)).toBe(
			true,
		);
		expect(isCombatTrackerReactionColorSettingKey('combatTrackerLocation')).toBe(false);
	});

	it('normalizes hex colors', () => {
		expect(normalizeHexColor('#ABC')).toBe('#aabbcc');
		expect(normalizeHexColor('#123456')).toBe('#123456');
		expect(normalizeHexColor('invalid')).toBe('#ffffff');
	});
});
