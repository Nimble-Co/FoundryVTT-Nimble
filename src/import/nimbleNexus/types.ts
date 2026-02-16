/**
 * TypeScript interfaces for Nimble Nexus monster import
 */

// Size categories matching both API and FoundryVTT
export type MonsterSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

// Armor types matching both API and FoundryVTT
export type MonsterArmor = 'none' | 'medium' | 'heavy';

// Level can be fractional strings or numbers
export type MonsterLevel = number | '1/4' | '1/3' | '1/2';

// Movement mode for non-walking movement
export type MovementMode = 'fly' | 'swim' | 'climb' | 'burrow' | 'teleport';

// Saving throw stats - API uses abbreviated names
export type SaveStat = 'str' | 'dex' | 'int' | 'wil';

// FoundryVTT saving throw stats - full names
export type FoundrySaveStat = 'strength' | 'dexterity' | 'intelligence' | 'will';

/**
 * Movement entry from the API
 */
export interface NimbleNexusMovement {
	speed: number;
	mode?: MovementMode;
}

/**
 * Monster ability (passive feature)
 */
export interface NimbleNexusAbility {
	name: string;
	description: string;
}

/**
 * Damage information for an action
 */
export interface NimbleNexusDamage {
	roll: string;
}

/**
 * Target information for an action
 */
export interface NimbleNexusTarget {
	reach?: number;
	range?: number;
}

/**
 * Monster action (active ability)
 */
export interface NimbleNexusAction {
	name: string;
	description?: string;
	damage?: NimbleNexusDamage;
	target?: NimbleNexusTarget;
}

/**
 * Bloodied phase information (for legendary monsters)
 */
export interface NimbleNexusBloodied {
	description: string;
}

/**
 * Last Stand phase information (for legendary monsters)
 */
export interface NimbleNexusLastStand {
	description: string;
}

/**
 * Monster attributes from the API
 */
export interface NimbleNexusMonsterAttributes {
	name: string;
	hp: number;
	level: MonsterLevel;
	size: MonsterSize;
	armor: MonsterArmor;
	kind?: string;
	legendary: boolean;
	minion?: boolean;
	role?: string;
	movement: NimbleNexusMovement[];
	abilities: NimbleNexusAbility[];
	actions: NimbleNexusAction[];
	actionsInstructions?: string;
	bloodied?: NimbleNexusBloodied;
	lastStand?: NimbleNexusLastStand;
	saves?: Partial<Record<SaveStat, number>>;
	description?: string;
}

/**
 * Family relationship reference
 */
export interface NimbleNexusFamilyRef {
	type: 'families';
	id: string;
}

/**
 * Monster relationships
 */
export interface NimbleNexusMonsterRelationships {
	families?: {
		data: NimbleNexusFamilyRef[];
	};
}

/**
 * Single monster from the API response
 */
export interface NimbleNexusMonster {
	type: 'monsters';
	id: string;
	attributes: NimbleNexusMonsterAttributes;
	relationships?: NimbleNexusMonsterRelationships;
}

/**
 * Pagination links
 */
export interface NimbleNexusLinks {
	next?: string;
	self?: string;
}

/**
 * API response for monster list
 */
export interface NimbleNexusApiResponse {
	data: NimbleNexusMonster[];
	links?: NimbleNexusLinks;
}

/**
 * API response for single monster
 */
export interface NimbleNexusSingleMonsterResponse {
	data: NimbleNexusMonster;
}

/**
 * Monster type filter
 */
export type MonsterTypeFilter = 'all' | 'standard' | 'legendary' | 'minion';

/**
 * Monster role filter
 */
export type MonsterRoleFilter =
	| 'all'
	| 'ambusher'
	| 'aoe'
	| 'controller'
	| 'defender'
	| 'melee'
	| 'ranged'
	| 'skirmisher'
	| 'striker'
	| 'summoner'
	| 'support';

/**
 * Search/filter options for the API
 */
export interface NimbleNexusApiSearchOptions {
	search?: string;
	level?: string;
	limit?: number;
	cursor?: string;
	sort?: 'name' | '-name' | 'createdAt' | '-createdAt' | 'level' | '-level';
	include?: 'families';
	monsterType?: MonsterTypeFilter;
	role?: MonsterRoleFilter;
}

/**
 * Result of importing a single monster
 */
export interface ImportResult {
	success: boolean;
	monsterName: string;
	actorId?: string;
	error?: string;
}

/**
 * Result of a batch import operation
 */
export interface BatchImportResult {
	results: ImportResult[];
	createdFolderId?: string;
}

/**
 * Options for importing monsters
 */
export interface ImportOptions {
	folderId?: string;
	createFolder?: boolean;
	folderName?: string;
}

/**
 * Actor type determination
 */
export type ActorType = 'npc' | 'soloMonster' | 'minion';
