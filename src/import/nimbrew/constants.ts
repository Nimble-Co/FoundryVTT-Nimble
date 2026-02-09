/**
 * Constants and mappings for Nimbrew monster import
 */

import type { FoundrySaveStat, SaveStat } from './types.js';

/**
 * API base URL for nimble.nexus
 */
export const NIMBLE_NEXUS_API_URL = 'https://nimble.nexus/api';

/**
 * Default pagination limit
 */
export const DEFAULT_PAGE_LIMIT = 100;

/**
 * Maximum pagination limit allowed by API
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * Map API save stat abbreviations to FoundryVTT full names
 */
export const SAVE_STAT_MAP: Record<SaveStat, FoundrySaveStat> = {
	str: 'strength',
	dex: 'dexterity',
	int: 'intelligence',
	wil: 'will',
};

/**
 * Map API save values to FoundryVTT defaultRollMode values
 * API: negative = disadvantage, 0 = normal, positive = advantage
 * FoundryVTT: -2 = double disadvantage, -1 = disadvantage, 0 = normal, 1 = advantage, 2 = double advantage
 */
export function saveValueToRollMode(value: number): number {
	if (value < 0) return -1; // disadvantage
	if (value > 0) return 1; // advantage
	return 0; // normal
}

/**
 * Size to token dimensions mapping
 */
export const SIZE_TO_TOKEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
	tiny: { width: 0.5, height: 0.5 },
	small: { width: 0.5, height: 0.5 },
	medium: { width: 1, height: 1 },
	large: { width: 2, height: 2 },
	huge: { width: 3, height: 3 },
	gargantuan: { width: 4, height: 4 },
};

/**
 * Monster feature subtypes
 */
export const FEATURE_SUBTYPES = {
	feature: 'feature',
	action: 'action',
	attackSequence: 'attackSequence',
	bloodied: 'bloodied',
	lastStand: 'lastStand',
} as const;

/**
 * Default icons for different feature types
 */
export const DEFAULT_FEATURE_ICONS: Record<string, string> = {
	feature: 'icons/svg/item-bag.svg',
	action: 'icons/svg/sword.svg',
	attackSequence: 'icons/svg/sword.svg',
	bloodied: 'icons/svg/blood.svg',
	lastStand: 'icons/svg/skull.svg',
};

/**
 * Default actor image
 */
export const DEFAULT_ACTOR_IMAGE = 'icons/svg/mystery-man.svg';

/**
 * Level string to number conversion for fractional levels
 */
export const LEVEL_STRING_TO_NUMBER: Record<string, number> = {
	'1/4': 0.25,
	'1/3': 0.33,
	'1/2': 0.5,
};

/**
 * Convert level to string for FoundryVTT
 */
export function levelToString(level: number | string): string {
	if (typeof level === 'string') return level;
	return String(level);
}
