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

export const COMBAT_TRACKER_LOCATION_SETTING_KEY = 'combatTrackerLocation';

export const COMBAT_TRACKER_LOCATION_VALUES = ['left', 'right', 'top', 'bottom'] as const;

export type CombatTrackerLocation = (typeof COMBAT_TRACKER_LOCATION_VALUES)[number];
export const COMBAT_TRACKER_SIDE_LOCATION_VALUES = ['left', 'right'] as const;
export type CombatTrackerSideLocation = (typeof COMBAT_TRACKER_SIDE_LOCATION_VALUES)[number];

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

const DEFAULT_COMBAT_TRACKER_LOCATION: CombatTrackerSideLocation = 'left';

const LEGACY_CURRENT_TURN_COLOR_SETTING_KEY = 'combatTrackerCurrentTurnColor';

const HEX_COLOR_PATTERN = /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/;
const ANIMATION_SLIDER_MIN = 0;
const ANIMATION_SLIDER_MAX = 100;

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

const COMBAT_TRACKER_LOCATION_VALUE_SET = new Set<CombatTrackerLocation>(
	COMBAT_TRACKER_LOCATION_VALUES,
);
const COMBAT_TRACKER_SIDE_LOCATION_VALUE_SET = new Set<CombatTrackerSideLocation>(
	COMBAT_TRACKER_SIDE_LOCATION_VALUES,
);

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

function expandShortHexColor(value: string): string {
	if (value.length !== 4) return value;
	return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
}

export function normalizeCurrentTurnAnimationSliderValue(value: unknown, fallback = 50): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(ANIMATION_SLIDER_MAX, Math.max(ANIMATION_SLIDER_MIN, Math.round(parsed)));
}

export function normalizeCombatTrackerLocation(value: unknown): CombatTrackerLocation {
	if (typeof value !== 'string') return DEFAULT_COMBAT_TRACKER_LOCATION;
	const normalized = value.trim().toLowerCase();
	return COMBAT_TRACKER_LOCATION_VALUE_SET.has(normalized as CombatTrackerLocation)
		? (normalized as CombatTrackerLocation)
		: DEFAULT_COMBAT_TRACKER_LOCATION;
}

export function normalizeCombatTrackerSideLocation(
	value: unknown,
	fallback: CombatTrackerSideLocation = DEFAULT_COMBAT_TRACKER_LOCATION,
): CombatTrackerSideLocation {
	const normalizedLocation = normalizeCombatTrackerLocation(value);
	return COMBAT_TRACKER_SIDE_LOCATION_VALUE_SET.has(normalizedLocation as CombatTrackerSideLocation)
		? (normalizedLocation as CombatTrackerSideLocation)
		: fallback;
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

export function registerCombatTrackerSettings(): void {
	registerWorldSetting(COMBAT_TRACKER_LOCATION_SETTING_KEY, {
		name: 'Combat Tracker Location',
		hint: 'Controls where the combat tracker is placed on screen',
		scope: 'world',
		config: false,
		type: String,
		default: DEFAULT_COMBAT_TRACKER_LOCATION,
	});

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
}

export function getCombatTrackerLocation(): CombatTrackerSideLocation {
	return normalizeCombatTrackerSideLocation(
		game.settings.get('nimble' as 'core', COMBAT_TRACKER_LOCATION_SETTING_KEY as 'rollMode'),
	);
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

	if (settingKey.startsWith('nimble.')) {
		const unqualifiedKey = settingKey.slice('nimble.'.length);
		return CURRENT_TURN_ANIMATION_SETTING_KEY_SET.has(
			unqualifiedKey as CurrentTurnAnimationSettingKey,
		);
	}

	return false;
}

export function isCombatTrackerLocationSettingKey(settingKey: unknown): boolean {
	if (typeof settingKey !== 'string') return false;
	if (settingKey === COMBAT_TRACKER_LOCATION_SETTING_KEY) return true;
	return settingKey === `nimble.${COMBAT_TRACKER_LOCATION_SETTING_KEY}`;
}

export async function setCombatTrackerLocation(location: CombatTrackerLocation): Promise<void> {
	const normalizedLocation = normalizeCombatTrackerLocation(location);
	if (
		!COMBAT_TRACKER_SIDE_LOCATION_VALUE_SET.has(normalizedLocation as CombatTrackerSideLocation)
	) {
		return;
	}

	await game.settings.set(
		'nimble' as 'core',
		COMBAT_TRACKER_LOCATION_SETTING_KEY as 'rollMode',
		normalizedLocation as never,
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
