export const COMBAT_TRACKER_PLAYER_MONSTER_EXPANSION_SETTING_KEY =
	'combatTrackerPlayersCanExpandMonsterCards';
export const COMBAT_TRACKER_CENTER_ACTIVE_CARD_SETTING_KEY = 'combatTrackerCenterActiveCard';
export const COMBAT_TRACKER_ENABLED_SETTING_KEY = 'combatTrackerNcctEnabled';
export const COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY = 'combatTrackerNcctWidthLevel';
export const COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY = 'combatTrackerNcctCardSizeLevel';
export const COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY = 'combatTrackerNcctActionDiceColor';
export const COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY =
	'combatTrackerNcctNonPlayerHpPermissions';

export type CombatTrackerRolePermissionKey = 'player' | 'trusted' | 'assistant' | 'gamemaster';

export type CombatTrackerRolePermissionConfig = Record<CombatTrackerRolePermissionKey, boolean>;

const DEFAULT_PLAYER_MONSTER_CARD_EXPANSION_PERMISSION = false;
const DEFAULT_CENTER_ACTIVE_CARD_SETTING = true;
const DEFAULT_NCCT_ENABLED_SETTING = true;
const DEFAULT_NCCT_WIDTH_LEVEL_SETTING = 2;
const DEFAULT_NCCT_CARD_SIZE_LEVEL_SETTING = 3;
const DEFAULT_NCCT_ACTION_DICE_COLOR_SETTING = '#6ce685';
const MIN_NCCT_WIDTH_LEVEL_SETTING = 1;
const MAX_NCCT_WIDTH_LEVEL_SETTING = 6;
const MIN_NCCT_CARD_SIZE_LEVEL_SETTING = 1;
const MAX_NCCT_CARD_SIZE_LEVEL_SETTING = 6;
const DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING: CombatTrackerRolePermissionConfig = {
	player: false,
	trusted: false,
	assistant: true,
	gamemaster: true,
};
const NCCT_ACTION_DICE_COLOR_CSS_VAR = '--nimble-ncct-action-die-color';

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

function normalizeNcctWidthLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return DEFAULT_NCCT_WIDTH_LEVEL_SETTING;
	const rounded = Math.round(numericValue);
	return Math.min(MAX_NCCT_WIDTH_LEVEL_SETTING, Math.max(MIN_NCCT_WIDTH_LEVEL_SETTING, rounded));
}

function normalizeNcctCardSizeLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return DEFAULT_NCCT_CARD_SIZE_LEVEL_SETTING;
	const rounded = Math.round(numericValue);
	return Math.min(
		MAX_NCCT_CARD_SIZE_LEVEL_SETTING,
		Math.max(MIN_NCCT_CARD_SIZE_LEVEL_SETTING, rounded),
	);
}

function normalizeHexColor(value: unknown): string {
	if (typeof value !== 'string') return DEFAULT_NCCT_ACTION_DICE_COLOR_SETTING;
	const normalized = value.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
	const shortHexMatch = /^#([0-9a-f]{3})$/.exec(normalized);
	if (shortHexMatch) {
		const [red, green, blue] = shortHexMatch[1].split('');
		return `#${red}${red}${green}${green}${blue}${blue}`;
	}
	return DEFAULT_NCCT_ACTION_DICE_COLOR_SETTING;
}

function applyNcctActionDiceColorCssVariable(value: unknown): void {
	if (typeof document === 'undefined') return;
	const normalizedColor = normalizeHexColor(value);
	document.documentElement.style.setProperty(NCCT_ACTION_DICE_COLOR_CSS_VAR, normalizedColor);
}

function normalizePermissionValue(
	value: unknown,
	fallback: boolean,
): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	return fallback;
}

function normalizeRolePermissionConfig(value: unknown): CombatTrackerRolePermissionConfig {
	const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
	return {
		player: normalizePermissionValue(source.player, DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING.player),
		trusted: normalizePermissionValue(source.trusted, DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING.trusted),
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

function getUserRoleValue(roleKey: 'PLAYER' | 'TRUSTED' | 'ASSISTANT' | 'GAMEMASTER', fallback: number): number {
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
		name: 'NCCT Center Active Card',
		hint: 'Keep the active card centered and wrap cards around it like the original carousel',
		scope: 'world',
		config: false,
		type: Boolean,
		default: DEFAULT_CENTER_ACTIVE_CARD_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_ENABLED_SETTING_KEY, {
		name: 'Enable NCCT',
		hint: 'Show the Nimble Carousel Combat Tracker at the top of the screen',
		scope: 'world',
		config: true,
		type: Boolean,
		default: DEFAULT_NCCT_ENABLED_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY, {
		name: 'NCCT Width Level',
		hint: 'Controls how wide the NCCT can be in the top tracker',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_NCCT_WIDTH_LEVEL_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY, {
		name: 'NCCT Card Size Level',
		hint: 'Controls how large NCCT combatant cards appear',
		scope: 'world',
		config: false,
		type: Number,
		default: DEFAULT_NCCT_CARD_SIZE_LEVEL_SETTING,
	});

	registerWorldSetting(COMBAT_TRACKER_NON_PLAYER_HP_PERMISSION_SETTING_KEY, {
		name: 'NCCT Non-player HP Permissions',
		hint: 'Configure which user roles can view non-player HP on NCCT cards',
		scope: 'world',
		config: false,
		type: Object,
		default: foundry.utils.deepClone(DEFAULT_NON_PLAYER_HP_PERMISSION_SETTING),
	});

	registerWorldSetting(COMBAT_TRACKER_ACTION_DICE_COLOR_SETTING_KEY, {
		name: 'NCCT Action Dice Color',
		hint: 'Choose your personal action dice color for NCCT',
		scope: 'client',
		config: false,
		type: String,
		default: DEFAULT_NCCT_ACTION_DICE_COLOR_SETTING,
		onChange: (value) => {
			applyNcctActionDiceColorCssVariable(value);
		},
	});

	applyNcctActionDiceColorCssVariable(getCombatTrackerActionDiceColor());
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

export function getCombatTrackerNcctEnabled(): boolean {
	return Boolean(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_ENABLED_SETTING_KEY as 'rollMode'),
	);
}

export function getCombatTrackerNcctWidthLevel(): number {
	return normalizeNcctWidthLevel(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY as 'rollMode'),
	);
}

export function getCombatTrackerNcctCardSizeLevel(): number {
	return normalizeNcctCardSizeLevel(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY as 'rollMode'),
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

export async function setCombatTrackerNcctEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_ENABLED_SETTING_KEY as 'rollMode',
		Boolean(value) as never,
	);
}

export async function setCombatTrackerNcctWidthLevel(value: number): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_WIDTH_LEVEL_SETTING_KEY as 'rollMode',
		normalizeNcctWidthLevel(value) as never,
	);
}

export async function setCombatTrackerNcctCardSizeLevel(value: number): Promise<void> {
	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_CARD_SIZE_LEVEL_SETTING_KEY as 'rollMode',
		normalizeNcctCardSizeLevel(value) as never,
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
	applyNcctActionDiceColorCssVariable(normalizedColor);
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
