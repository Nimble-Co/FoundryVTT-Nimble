export const COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY =
	'combatTrackerPlayersCanExpandMonsterCards';
export const COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY =
	'combatTrackerCtResourceDrawerHover';
export const COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY =
	'combatTrackerCtPlayerHpBarTextMode';
export const COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY =
	'combatTrackerCtNonPlayerHpBarEnabled';
export const COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY =
	'combatTrackerCtNonPlayerHpBarTextMode';
export const COMBAT_TRACKER_ENABLED_SETTING_KEY = 'combatTrackerCtEnabled';
export const COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY = 'combatTrackerCtWidthLevel';
export const COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY = 'combatTrackerCtCardSizeLevel';
export const COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY = 'combatTrackerCtActionDiceColor';
export const COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY = 'combatTrackerCtReactionColor';
export const COMBAT_TRACKER_CLIENT_SETTING_UPDATED_EVENT_NAME = 'nimble:ct-client-setting-updated';
export const CURRENT_TURN_ANIMATION_SETTING_KEYS = {
	pulseAnimation: 'combatTrackerCurrentTurnPulseAnimation',
	pulseSpeed: 'combatTrackerCurrentTurnPulseSpeed',
	borderGlow: 'combatTrackerCurrentTurnBorderGlow',
	borderGlowColor: 'combatTrackerCurrentTurnBorderGlowColor',
	borderGlowSize: 'combatTrackerCurrentTurnBorderGlowSize',
	edgeCrawler: 'combatTrackerCurrentTurnEdgeCrawler',
	edgeCrawlerColor: 'combatTrackerCurrentTurnEdgeCrawlerColor',
	edgeCrawlerSize: 'combatTrackerCurrentTurnEdgeCrawlerSize',
} as const;

export type CombatTrackerHpBarTextMode = 'none' | 'hpState' | 'percentage';
export type CombatTrackerPlayerHpBarTextMode = CombatTrackerHpBarTextMode;
export type CombatTrackerNonPlayerHpBarTextMode = CombatTrackerHpBarTextMode;
export interface CurrentTurnAnimationSettings {
	pulseAnimation: boolean;
	pulseSpeed: number;
	borderGlow: boolean;
	borderGlowColor: string;
	borderGlowSize: number;
	edgeCrawler: boolean;
	edgeCrawlerColor: string;
	edgeCrawlerSize: number;
}

const DEFAULT_PLAYER_MONSTER_CARD_EXPANSION_PERMISSION = false;
const DEFAULT_CT_RESOURCE_DRAWER_HOVER_SETTING = true;
const DEFAULT_CT_PLAYER_HP_BAR_TEXT_MODE_SETTING: CombatTrackerPlayerHpBarTextMode = 'none';
const DEFAULT_CT_NON_PLAYER_HP_BAR_ENABLED_SETTING = false;
const DEFAULT_CT_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING: CombatTrackerNonPlayerHpBarTextMode = 'none';
const DEFAULT_CT_ENABLED_SETTING = true;
const DEFAULT_CT_WIDTH_LEVEL_SETTING = 10;
const DEFAULT_CT_CARD_SIZE_LEVEL_SETTING = 5;
const DEFAULT_CT_ACTION_DICE_COLOR_SETTING = '#ffffff';
const DEFAULT_CT_REACTION_COLOR_SETTING = '#4fc3f7';
const DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS: CurrentTurnAnimationSettings = {
	pulseAnimation: true,
	pulseSpeed: 50,
	borderGlow: true,
	borderGlowColor: '#FFFFFF',
	borderGlowSize: 50,
	edgeCrawler: true,
	edgeCrawlerColor: '#FFFFFF',
	edgeCrawlerSize: 50,
};
const MIN_CT_WIDTH_LEVEL_SETTING = 1;
const MAX_CT_WIDTH_LEVEL_SETTING = 10;
const MIN_CT_CARD_SIZE_LEVEL_SETTING = 1;
const MAX_CT_CARD_SIZE_LEVEL_SETTING = 10;
const LEGACY_CURRENT_TURN_COLOR_SETTING_KEY = 'combatTrackerCurrentTurnColor';
const HEX_COLOR_PATTERN = /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/;
const ANIMATION_SLIDER_MIN = 0;
const ANIMATION_SLIDER_MAX = 100;
const CT_ACTION_DICE_COLOR_CSS_VAR = '--nimble-ct-action-die-color';
const CT_REACTION_COLOR_CSS_VAR = '--nimble-ct-reaction-color';
type CurrentTurnAnimationSettingKey =
	(typeof CURRENT_TURN_ANIMATION_SETTING_KEYS)[keyof typeof CURRENT_TURN_ANIMATION_SETTING_KEYS];
const CURRENT_TURN_ANIMATION_SETTING_KEY_SET = new Set<CurrentTurnAnimationSettingKey>(
	Object.values(CURRENT_TURN_ANIMATION_SETTING_KEYS),
);
const CURRENT_TURN_ANIMATION_COLOR_SETTING_KEYS = new Set<CurrentTurnAnimationSettingKey>([
	CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor,
	CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerColor,
]);
const CURRENT_TURN_ANIMATION_SLIDER_SETTING_KEYS = new Set<CurrentTurnAnimationSettingKey>([
	CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseSpeed,
	CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowSize,
	CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize,
]);

function registerWorldSetting(
	key: string,
	options: Parameters<typeof game.settings.register>[2],
): void {
	game.settings.register(
		'nimble' as 'core',
		key as 'rollMode',
		options as unknown as Parameters<typeof game.settings.register>[2],
	);
}

function normalizeCtWidthLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return DEFAULT_CT_WIDTH_LEVEL_SETTING;
	const rounded = Math.round(numericValue);
	return Math.min(MAX_CT_WIDTH_LEVEL_SETTING, Math.max(MIN_CT_WIDTH_LEVEL_SETTING, rounded));
}

function normalizeCtCardSizeLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return DEFAULT_CT_CARD_SIZE_LEVEL_SETTING;
	const rounded = Math.round(numericValue);
	return Math.min(
		MAX_CT_CARD_SIZE_LEVEL_SETTING,
		Math.max(MIN_CT_CARD_SIZE_LEVEL_SETTING, rounded),
	);
}

function normalizeHpBarTextMode(value: unknown): CombatTrackerHpBarTextMode {
	return value === 'hpState' || value === 'percentage'
		? value
		: DEFAULT_CT_PLAYER_HP_BAR_TEXT_MODE_SETTING;
}

export function normalizeHexColor(value: unknown): string {
	if (typeof value !== 'string') return DEFAULT_CT_ACTION_DICE_COLOR_SETTING;
	const normalized = value.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
	const shortHexMatch = /^#([0-9a-f]{3})$/.exec(normalized);
	if (shortHexMatch) {
		const [red, green, blue] = [...shortHexMatch[1]];
		return `#${red}${red}${green}${green}${blue}${blue}`;
	}
	return DEFAULT_CT_ACTION_DICE_COLOR_SETTING;
}

function expandShortHexColor(value: string): string {
	if (value.length !== 4) return value;
	return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
}

export function normalizeCurrentTurnAnimationSliderValue(value: unknown, fallback = 50): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(ANIMATION_SLIDER_MAX, Math.max(ANIMATION_SLIDER_MIN, Math.round(parsed)));
}

export function normalizeCombatTrackerAnimationColor(value: unknown): string {
	if (typeof value !== 'string') {
		return DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.borderGlowColor;
	}

	const normalized = value.trim();
	if (!HEX_COLOR_PATTERN.test(normalized)) {
		return DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.borderGlowColor;
	}

	return expandShortHexColor(normalized).toUpperCase();
}

function applyCtActionDiceColorCssVariable(value: unknown): void {
	if (typeof document === 'undefined') return;
	const normalizedColor = normalizeHexColor(value);
	document.documentElement.style.setProperty(CT_ACTION_DICE_COLOR_CSS_VAR, normalizedColor);
}

function applyCtReactionColorCssVariable(value: unknown): void {
	if (typeof document === 'undefined') return;
	const normalizedColor = normalizeHexColor(value);
	document.documentElement.style.setProperty(CT_REACTION_COLOR_CSS_VAR, normalizedColor);
}

function dispatchCtClientSettingUpdated(settingKey: string): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent(COMBAT_TRACKER_CLIENT_SETTING_UPDATED_EVENT_NAME, {
			detail: { key: settingKey },
		}),
	);
}

export function registerCombatTrackerSettings(): void {
	registerWorldSetting(COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY, {
		name: 'Combat Tracker Player Monster Card Expansion',
		hint: 'Allow non-GM users to expand grouped monster and minion cards into individual cards',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_PLAYER_MONSTER_CARD_EXPANSION_PERMISSION,
	});

	registerWorldSetting(COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY, {
		name: 'Combat Tracker Resource Drawer Hover',
		hint: 'When enabled, player resource drawers open only on hover',
		scope: 'client',
		config: false,
		type: Boolean,
		default: DEFAULT_CT_RESOURCE_DRAWER_HOVER_SETTING,
		onChange: () => {
			dispatchCtClientSettingUpdated(COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY);
		},
	});

	registerWorldSetting(COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY, {
		name: 'Combat Tracker Player HP Bar Center Text',
		hint: 'Choose whether player HP bars show nothing, health state, or HP percentage',
		scope: 'client',
		config: false,
		type: String,
		choices: {
			none: 'None',
			hpState: 'Health State',
			percentage: 'HP %',
		},
		default: DEFAULT_CT_PLAYER_HP_BAR_TEXT_MODE_SETTING,
		onChange: () => {
			dispatchCtClientSettingUpdated(COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY);
		},
	});

	registerWorldSetting(COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY, {
		name: 'Combat Tracker Non-player HP Bar',
		hint: 'Show a hit point bar below individual non-player combatant cards',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CT_NON_PLAYER_HP_BAR_ENABLED_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY, {
		name: 'Combat Tracker Non-player HP Bar Center Text',
		hint: 'Choose whether centered text in the non-player HP bar shows nothing, health state, or HP percentage',
		scope: 'world',
		config: false,
		type: String,
		choices: {
			none: 'None',
			hpState: 'Health State',
			percentage: 'HP %',
		},
		default: DEFAULT_CT_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_ENABLED_SETTING_KEY, {
		name: 'Enable Combat Tracker',
		hint: 'Show the Combat Tracker at the top of the screen',
		scope: 'world',
		config: true,
		type: Boolean,
		default: DEFAULT_CT_ENABLED_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY, {
		name: 'Combat Tracker Width Level',
		hint: 'Controls how wide Combat Tracker can be in the top tracker',
		scope: 'client',
		config: false,
		type: Number,
		default: DEFAULT_CT_WIDTH_LEVEL_SETTING,
		onChange: () => {
			dispatchCtClientSettingUpdated(COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY);
		},
	});

	registerWorldSetting(COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY, {
		name: 'Combat Tracker Card Size Level',
		hint: 'Controls how large Combat Tracker combatant cards appear',
		scope: 'client',
		config: false,
		type: Number,
		default: DEFAULT_CT_CARD_SIZE_LEVEL_SETTING,
		onChange: () => {
			dispatchCtClientSettingUpdated(COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY);
		},
	});

	registerWorldSetting(COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY, {
		name: 'Combat Tracker Action Color',
		hint: 'Choose your personal action color for Combat Tracker',
		scope: 'client',
		config: false,
		type: String,
		default: DEFAULT_CT_ACTION_DICE_COLOR_SETTING,
		onChange: (value) => {
			applyCtActionDiceColorCssVariable(value);
			dispatchCtClientSettingUpdated(COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY);
		},
	});

	registerWorldSetting(COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY, {
		name: 'Combat Tracker Reaction Color',
		hint: 'Choose your personal reaction color for Combat Tracker',
		scope: 'client',
		config: false,
		type: String,
		default: DEFAULT_CT_REACTION_COLOR_SETTING,
		onChange: (value) => {
			applyCtReactionColorCssVariable(value);
			dispatchCtClientSettingUpdated(COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY);
		},
	});

	// Legacy settings retained as hidden registrations so existing worlds keep their values.
	registerWorldSetting(LEGACY_CURRENT_TURN_COLOR_SETTING_KEY, {
		name: 'Combat Tracker Current Turn Color (Legacy)',
		hint: 'Legacy current turn color setting used before per-animation colors',
		scope: 'world',
		config: false,
		type: String,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.borderGlowColor,
	});
	const legacyColorDefault = normalizeCombatTrackerAnimationColor(
		game.settings.get('nimble' as 'core', LEGACY_CURRENT_TURN_COLOR_SETTING_KEY as 'rollMode'),
	);
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseAnimation, {
		name: 'Combat Tracker Current Turn Pulse Animation',
		hint: 'Enable pulse animation for the active combatant card',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.pulseAnimation,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseSpeed, {
		name: 'Combat Tracker Current Turn Pulse Speed',
		hint: 'Adjust pulse animation speed for the active combatant card',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.pulseSpeed,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlow, {
		name: 'Combat Tracker Current Turn Border Glow',
		hint: 'Enable border glow for the active combatant card',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.borderGlow,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor, {
		name: 'Combat Tracker Border Glow Color',
		hint: 'Color used by the border glow for the active combatant card',
		scope: 'world',
		config: false,
		type: String,
		default: legacyColorDefault,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowSize, {
		name: 'Combat Tracker Border Glow Size',
		hint: 'Adjust the glow size for the active combatant card border',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.borderGlowSize,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawler, {
		name: 'Combat Tracker Current Turn Edge Crawler',
		hint: 'Enable edge crawler effect for the active combatant card',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.edgeCrawler,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerColor, {
		name: 'Combat Tracker Edge Crawler Color',
		hint: 'Color used by the edge crawler for the active combatant card',
		scope: 'world',
		config: false,
		type: String,
		default: legacyColorDefault,
	});
	registerWorldSetting(CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize, {
		name: 'Combat Tracker Edge Crawler Size',
		hint: 'Adjust capsule size for the active combatant edge crawler effect',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.edgeCrawlerSize,
	});

	applyCtActionDiceColorCssVariable(getCombatTrackerActionDiceColor());
	applyCtReactionColorCssVariable(getCombatTrackerReactionColor());
}

export function getCombatTrackerPlayersCanExpandMonsterCards(): boolean {
	return Boolean(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY as 'rollMode',
		),
	);
}

export function isCombatTrackerPlayerMonsterExpansionSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY}`;
}

export function getCombatTrackerResourceDrawerHoverEnabled(): boolean {
	return Boolean(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerPlayerHpBarTextMode(): CombatTrackerPlayerHpBarTextMode {
	return normalizeHpBarTextMode(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerNonPlayerHpBarEnabled(): boolean {
	return Boolean(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerNonPlayerHpBarTextMode(): CombatTrackerNonPlayerHpBarTextMode {
	return normalizeHpBarTextMode(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerCtEnabled(): boolean {
	return Boolean(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_ENABLED_SETTING_KEY as 'rollMode'),
	);
}

export function getCombatTrackerCtWidthLevel(): number {
	return normalizeCtWidthLevel(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY as 'rollMode'),
	);
}

export function getCombatTrackerCtCardSizeLevel(): number {
	return normalizeCtCardSizeLevel(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY as 'rollMode'),
	);
}

export function getCombatTrackerActionDiceColor(): string {
	return normalizeHexColor(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerReactionColor(): string {
	return normalizeHexColor(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY as 'rollMode'),
	);
}

export function isCombatTrackerResourceDrawerHoverSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY}`;
}

export function isCombatTrackerPlayerHpBarTextModeSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY}`;
}

export function isCombatTrackerNonPlayerHpBarEnabledSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY}`;
}

export function isCombatTrackerNonPlayerHpBarTextModeSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY}`;
}

export function isCombatTrackerEnabledSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_ENABLED_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_ENABLED_SETTING_KEY}`;
}

export function isCombatTrackerWidthLevelSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY}`;
}

export function isCombatTrackerCardSizeLevelSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY}`;
}

export function isCombatTrackerActionDiceColorSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY}`;
}

export function isCombatTrackerReactionColorSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY}`;
}

export function getCurrentTurnAnimationSettings(): CurrentTurnAnimationSettings {
	return {
		pulseAnimation: Boolean(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseAnimation as 'rollMode',
			),
		),
		pulseSpeed: normalizeCurrentTurnAnimationSliderValue(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.pulseSpeed as 'rollMode',
			),
			DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.pulseSpeed,
		),
		borderGlow: Boolean(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlow as 'rollMode',
			),
		),
		borderGlowColor: normalizeCombatTrackerAnimationColor(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowColor as 'rollMode',
			),
		),
		borderGlowSize: normalizeCurrentTurnAnimationSliderValue(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.borderGlowSize as 'rollMode',
			),
			DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.borderGlowSize,
		),
		edgeCrawler: Boolean(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawler as 'rollMode',
			),
		),
		edgeCrawlerColor: normalizeCombatTrackerAnimationColor(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerColor as 'rollMode',
			),
		),
		edgeCrawlerSize: normalizeCurrentTurnAnimationSliderValue(
			game.settings.get(
				'nimble' as 'core',
				CURRENT_TURN_ANIMATION_SETTING_KEYS.edgeCrawlerSize as 'rollMode',
			),
			DEFAULT_CURRENT_TURN_ANIMATION_SETTINGS.edgeCrawlerSize,
		),
	};
}

export function isCurrentTurnAnimationSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (CURRENT_TURN_ANIMATION_SETTING_KEY_SET.has(settingKey as CurrentTurnAnimationSettingKey)) {
		return true;
	}
	if (!settingKey.startsWith('nimble.')) return false;
	return CURRENT_TURN_ANIMATION_SETTING_KEY_SET.has(
		settingKey.slice('nimble.'.length) as CurrentTurnAnimationSettingKey,
	);
}

export async function setCombatTrackerPlayersCanExpandMonsterCards(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerResourceDrawerHoverEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_RESOURCE_DRAWER_HOVER_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerPlayerHpBarTextMode(
	value: CombatTrackerPlayerHpBarTextMode,
): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY as 'rollMode',
		normalizeHpBarTextMode(value) as never,
	);
}

export async function setCombatTrackerNonPlayerHpBarEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_NON_PLAYER_HP_BAR_ENABLED_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerNonPlayerHpBarTextMode(
	value: CombatTrackerNonPlayerHpBarTextMode,
): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_NON_PLAYER_HP_BAR_TEXT_MODE_SETTING_KEY as 'rollMode',
		normalizeHpBarTextMode(value) as never,
	);
}

export async function setCombatTrackerCtEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_ENABLED_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerCtWidthLevel(value: number): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY as 'rollMode',
		normalizeCtWidthLevel(value) as never,
	);
}

export async function setCombatTrackerCtCardSizeLevel(value: number): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY as 'rollMode',
		normalizeCtCardSizeLevel(value) as never,
	);
}

export async function setCombatTrackerActionDiceColor(value: string): Promise<void> {
	const normalizedColor = normalizeHexColor(value);
	applyCtActionDiceColorCssVariable(normalizedColor);
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY as 'rollMode',
		normalizedColor as never,
	);
}

export async function setCombatTrackerReactionColor(value: string): Promise<void> {
	const normalizedColor = normalizeHexColor(value);
	applyCtReactionColorCssVariable(normalizedColor);
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_REACTION_COLOR_SETTING_KEY as 'rollMode',
		normalizedColor as never,
	);
}

export async function setCurrentTurnAnimationSetting(
	settingKey: CurrentTurnAnimationSettingKey,
	value: boolean | string | number,
): Promise<void> {
	let normalizedValue: boolean | string | number = value;
	if (CURRENT_TURN_ANIMATION_COLOR_SETTING_KEYS.has(settingKey)) {
		normalizedValue = normalizeCombatTrackerAnimationColor(value);
	} else if (CURRENT_TURN_ANIMATION_SLIDER_SETTING_KEYS.has(settingKey)) {
		normalizedValue = normalizeCurrentTurnAnimationSliderValue(value, 50);
	}

	await game.settings.set('nimble' as 'core', settingKey as 'rollMode', normalizedValue as never);
}
