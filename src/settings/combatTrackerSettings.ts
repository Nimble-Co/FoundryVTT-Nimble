export const COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY =
	'combatTrackerPlayersCanExpandMonsterCards';
export const COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY = 'combatTrackerCenterActiveCard';
export const COMBAT_TRACKER_ENABLED_SETTING_KEY = 'combatTrackerCtEnabled';
export const COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY = 'combatTrackerCtWidthLevel';
export const COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY = 'combatTrackerCtCardSizeLevel';
export const COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY = 'combatTrackerCtBadgeSizeLevel';
export const COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY = 'combatTrackerCtUseActionDice';
export const COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY = 'combatTrackerCtActionDiceColor';
export const COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY =
	'combatTrackerCtNonPlayerHpPermissions';

export type CombatTrackerRolePermissionKey = 'player' | 'trusted' | 'assistant' | 'gamemaster';

export type CombatTrackerRolePermissionConfig = Record<CombatTrackerRolePermissionKey, boolean>;

const DEFAULT_PLAYER_MONSTER_CARD_EXPANSION_PERMISSION = false;
const DEFAULT_CENTER_ACTIVE_CARD_SETTING = true;
const DEFAULT_CT_ENABLED_SETTING = true;
const DEFAULT_CT_WIDTH_LEVEL_SETTING = 2;
const DEFAULT_CT_CARD_SIZE_LEVEL_SETTING = 3;
const DEFAULT_CT_BADGE_SIZE_LEVEL_SETTING = 1;
const DEFAULT_CT_USE_ACTION_DICE_SETTING = false;
const DEFAULT_CT_ACTION_DICE_COLOR_SETTING = '#ffffff';
const MIN_CT_WIDTH_LEVEL_SETTING = 1;
const MAX_CT_WIDTH_LEVEL_SETTING = 6;
const MIN_CT_CARD_SIZE_LEVEL_SETTING = 1;
const MAX_CT_CARD_SIZE_LEVEL_SETTING = 6;
const MIN_CT_BADGE_SIZE_LEVEL_SETTING = 1;
const MAX_CT_BADGE_SIZE_LEVEL_SETTING = 6;
const DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING: CombatTrackerRolePermissionConfig = {
	player: false,
	trusted: false,
	assistant: true,
	gamemaster: true,
};
const CT_ACTION_DICE_COLOR_CSS_VAR = '--nimble-ct-action-die-color';

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

function normalizeCtBadgeSizeLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return DEFAULT_CT_BADGE_SIZE_LEVEL_SETTING;
	const rounded = Math.round(numericValue);
	return Math.min(
		MAX_CT_BADGE_SIZE_LEVEL_SETTING,
		Math.max(MIN_CT_BADGE_SIZE_LEVEL_SETTING, rounded),
	);
}

function normalizeHexColor(value: unknown): string {
	if (typeof value !== 'string') return DEFAULT_CT_ACTION_DICE_COLOR_SETTING;
	const normalized = value.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
	const shortHexMatch = /^#([0-9a-f]{3})$/.exec(normalized);
	if (shortHexMatch) {
		const [red, green, blue] = shortHexMatch[1].split('');
		return `#${red}${red}${green}${green}${blue}${blue}`;
	}
	return DEFAULT_CT_ACTION_DICE_COLOR_SETTING;
}

function applyCtActionDiceColorCssVariable(value: unknown): void {
	if (typeof document === 'undefined') return;
	const normalizedColor = normalizeHexColor(value);
	document.documentElement.style.setProperty(CT_ACTION_DICE_COLOR_CSS_VAR, normalizedColor);
}

function normalizePermissionValue(value: unknown, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	return fallback;
}

function normalizeRolePermissionConfig(value: unknown): CombatTrackerRolePermissionConfig {
	const source =
		typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
	return {
		player: normalizePermissionValue(
			source.player,
			DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING.player,
		),
		trusted: normalizePermissionValue(
			source.trusted,
			DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING.trusted,
		),
		assistant: normalizePermissionValue(
			source.assistant,
			DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING.assistant,
		),
		gamemaster: normalizePermissionValue(
			source.gamemaster,
			DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING.gamemaster,
		),
	};
}

function getUserRoleValue(
	roleKey: 'PLAYER' | 'TRUSTED' | 'ASSISTANT' | 'GAMEMASTER',
	fallback: number,
): number {
	const userRoles = (globalThis as { CONST?: { USER_ROLES?: Record<string, number> } }).CONST
		?.USER_ROLES;
	return Number(userRoles?.[roleKey] ?? fallback);
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

	registerWorldSetting(COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY, {
		name: 'Combat Tracker Center Active Card',
		hint: 'Keep the active card centered and wrap cards around it in turn order',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CENTER_ACTIVE_CARD_SETTING,
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
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_CT_WIDTH_LEVEL_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY, {
		name: 'Combat Tracker Card Size Level',
		hint: 'Controls how large Combat Tracker combatant cards appear',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_CT_CARD_SIZE_LEVEL_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY, {
		name: 'Combat Tracker Badge Size Level',
		hint: 'Controls how large top-left badges appear on Combat Tracker cards',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_CT_BADGE_SIZE_LEVEL_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY, {
		name: 'Combat Tracker Use Action Dice',
		hint: 'When enabled, Combat Tracker uses action dice instead of the numeric action box',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CT_USE_ACTION_DICE_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY, {
		name: 'Combat Tracker Non-player HP Permissions',
		hint: 'Configure which user roles can view non-player HP on Combat Tracker cards',
		scope: 'world',
		config: false,
		type: Object,
		default: foundry.utils.deepClone(DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING),
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
		},
	});

	applyCtActionDiceColorCssVariable(getCombatTrackerActionDiceColor());
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

export function getCombatTrackerCenterActiveCardEnabled(): boolean {
	return Boolean(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY as 'rollMode',
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

export function getCombatTrackerCtBadgeSizeLevel(): number {
	return normalizeCtBadgeSizeLevel(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY as 'rollMode',
		),
	);
}

export function getCombatTrackerUseActionDice(): boolean {
	return Boolean(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY as 'rollMode'),
	);
}

export function getCombatTrackerNonPlayerHitpointPermissionConfig(): CombatTrackerRolePermissionConfig {
	return normalizeRolePermissionConfig(
		game.settings.get(
			'nimble' as 'core',
			COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY as 'rollMode',
		),
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

export function isCombatTrackerCenterActiveCardSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY}`;
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

export function isCombatTrackerBadgeSizeLevelSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY}`;
}

export function isCombatTrackerUseActionDiceSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY}`;
}

export function isCombatTrackerNonPlayerHitpointPermissionSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY}`;
}

export function isCombatTrackerActionDiceColorSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY}`;
}

export async function setCombatTrackerPlayersCanExpandMonsterCards(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerCenterActiveCardEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
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

export async function setCombatTrackerCtBadgeSizeLevel(value: number): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_BADGE_SIZE_LEVEL_SETTING_KEY as 'rollMode',
		normalizeCtBadgeSizeLevel(value) as never,
	);
}

export async function setCombatTrackerUseActionDice(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_USE_ACTION_DICE_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerNonPlayerHitpointPermissionConfig(
	value: CombatTrackerRolePermissionConfig,
): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY as 'rollMode',
		normalizeRolePermissionConfig(value) as never,
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

export function canCurrentUserDisplayNonPlayerHitpointsOnCards(
	userRole = Number(game.user?.role ?? 0),
): boolean {
	const normalizedRole = Number.isFinite(userRole) ? Number(userRole) : 0;
	const permissionConfig = getCombatTrackerNonPlayerHitpointPermissionConfig();
	const gmRole = getUserRoleValue('GAMEMASTER', 4);
	const assistantRole = getUserRoleValue('ASSISTANT', 3);
	const trustedRole = getUserRoleValue('TRUSTED', 2);
	const playerRole = getUserRoleValue('PLAYER', 1);

	if (normalizedRole >= gmRole) return permissionConfig.gamemaster;
	if (normalizedRole >= assistantRole) return permissionConfig.assistant;
	if (normalizedRole >= trustedRole) return permissionConfig.trusted;
	if (normalizedRole >= playerRole) return permissionConfig.player;
	return false;
}
