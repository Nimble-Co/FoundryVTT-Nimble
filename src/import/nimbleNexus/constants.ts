/**
 * Constants and mappings for Nimble Nexus monster import
 */

import type { FoundrySaveStat, SaveStat } from './types.js';

/**
 * Base URL for nimble.nexus
 */
export const NIMBLE_NEXUS_BASE_URL = 'https://nimble.nexus';

/**
 * API base URL for nimble.nexus
 */
export const NIMBLE_NEXUS_API_URL = `${NIMBLE_NEXUS_BASE_URL}/api`;

/**
 * Storage URL for paperforge images
 */
export const NIMBLE_NEXUS_STORAGE_URL = 'https://nimble-nexus.fly.storage.tigris.dev';

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
 * Get full image URL from paperforge relative path
 * The API returns paths like "/paperforge/0006/portrait.png" but
 * actual files are stored as "100.png" on the storage bucket
 */
export function getMonsterImageUrl(paperforgeImageUrl?: string): string {
	if (!paperforgeImageUrl) return DEFAULT_ACTOR_IMAGE;
	// Replace portrait.png with 100.png (the actual filename in storage)
	const correctedPath = paperforgeImageUrl.replace('portrait.png', '100.png');
	return `${NIMBLE_NEXUS_STORAGE_URL}${correctedPath}`;
}

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

/**
 * Map damage type strings (case-insensitive) to canonical FoundryVTT damage types
 */
export const DAMAGE_TYPE_MAP: Record<string, string> = {
	// Standard damage types
	acid: 'acid',
	bludgeoning: 'bludgeoning',
	cold: 'cold',
	fire: 'fire',
	force: 'force',
	lightning: 'lightning',
	necrotic: 'necrotic',
	piercing: 'piercing',
	poison: 'poison',
	psychic: 'psychic',
	radiant: 'radiant',
	slashing: 'slashing',
	thunder: 'thunder',
	// Common abbreviations/variations
	blunt: 'bludgeoning',
	electric: 'lightning',
	holy: 'radiant',
	unholy: 'necrotic',
	magic: 'force',
	physical: 'bludgeoning',
};

/**
 * Map save abbreviations to full FoundryVTT save types
 */
export const SAVE_TYPE_ABBREVIATION_MAP: Record<
	string,
	'strength' | 'dexterity' | 'intelligence' | 'will'
> = {
	str: 'strength',
	strength: 'strength',
	dex: 'dexterity',
	dexterity: 'dexterity',
	int: 'intelligence',
	intelligence: 'intelligence',
	wil: 'will',
	will: 'will',
	wis: 'will', // Common alternative
	wisdom: 'will', // Common alternative
};

/**
 * Map condition names (case-insensitive) to canonical FoundryVTT condition names
 */
export const CONDITION_MAP: Record<string, string> = {
	blinded: 'blinded',
	bloodied: 'bloodied',
	charged: 'charged',
	charmed: 'charmed',
	concentration: 'concentration',
	confused: 'confused',
	dazed: 'dazed',
	dead: 'dead',
	despair: 'despair',
	distracted: 'distracted',
	dying: 'dying',
	frightened: 'frightened',
	grappled: 'grappled',
	hampered: 'hampered',
	incapacitated: 'incapacitated',
	invisible: 'invisible',
	paralyzed: 'paralyzed',
	petrified: 'petrified',
	poisoned: 'poisoned',
	prone: 'prone',
	restrained: 'restrained',
	riding: 'riding',
	silenced: 'silenced',
	slowed: 'slowed',
	stunned: 'stunned',
	smoldering: 'smoldering',
	taunted: 'taunted',
	unconscious: 'unconscious',
	wounded: 'wounded',
	// Common variations/abbreviations
	blind: 'blinded',
	charm: 'charmed',
	confuse: 'confused',
	daze: 'dazed',
	fear: 'frightened',
	feared: 'frightened',
	frighten: 'frightened',
	grapple: 'grappled',
	grabbed: 'grappled',
	grab: 'grappled',
	paralyze: 'paralyzed',
	paralyses: 'paralyzed',
	paralysis: 'paralyzed',
	petrify: 'petrified',
	petrifies: 'petrified',
	petrification: 'petrified',
	poison: 'poisoned',
	restrain: 'restrained',
	silence: 'silenced',
	slow: 'slowed',
	stun: 'stunned',
	stuns: 'stunned',
	taunt: 'taunted',
};
