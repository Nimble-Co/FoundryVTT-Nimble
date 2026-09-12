/**
 * TypeScript interfaces for Nimble Nexus monster import
 */

import type { ImportCreator } from '../importCredit.js';

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
	paperforgeImageUrl?: string;
}

/**
 * Family relationship reference
 */
export interface NimbleNexusFamilyRef {
	type: 'families';
	id: string;
}

/**
 * Reference to the user who published a piece of content
 */
export interface NimbleNexusCreatorRef {
	type: 'users';
	id: string;
}

/**
 * Monster relationships
 */
export interface NimbleNexusMonsterRelationships {
	families?: {
		data: NimbleNexusFamilyRef[];
	};
	creator?: {
		data: NimbleNexusCreatorRef | null;
	};
}

/**
 * A Nimble Nexus user who published content on the site
 */
export type NimbleNexusCreator = ImportCreator;

/**
 * Any Nimble Nexus resource that names a creator. Items and collections carry
 * the same relationship as monsters, so creator handling stays shared.
 */
export interface NimbleNexusCreatedResource {
	relationships?: {
		creator?: {
			data: NimbleNexusCreatorRef | null;
		};
	};
	/**
	 * Resolved from the response `included` array by the API client.
	 * This is not part of the wire format.
	 */
	creator?: NimbleNexusCreator;
}

/**
 * A resource from the top-level `included` array of a JSON:API response.
 * `included` mixes resource types, so callers must narrow on `type`.
 */
export interface NimbleNexusIncludedResource {
	type: string;
	id: string;
	attributes?: Record<string, unknown>;
}

/**
 * Single monster from the API response
 */
export interface NimbleNexusMonster extends NimbleNexusCreatedResource {
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
	included?: NimbleNexusIncludedResource[];
}

/**
 * API response for single monster
 */
export interface NimbleNexusSingleMonsterResponse {
	data: NimbleNexusMonster;
	included?: NimbleNexusIncludedResource[];
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
 * Relationships the API can side-load into `included`.
 * An unsupported value makes the API answer 400, so it is a closed set.
 */
export type NimbleNexusInclude = 'families' | 'creator';

/**
 * Search/filter options for the API
 */
export interface NimbleNexusApiSearchOptions {
	search?: string;
	level?: string;
	limit?: number;
	cursor?: string;
	sort?: 'name' | '-name' | 'createdAt' | '-createdAt' | 'level' | '-level';
	include?: NimbleNexusInclude[];
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

/**
 * Save type for parsed data
 */
export type ParsedSaveType = 'strength' | 'dexterity' | 'intelligence' | 'will';

/**
 * Parsed saving throw information from action description
 */
export interface ParsedSavingThrow {
	dc: number;
	saveType: ParsedSaveType;
	consequence?: string;
	halfOnSave: boolean;
}

/**
 * Context in which a condition applies
 */
export type ConditionContext = 'hit' | 'failedSave' | 'criticalHit' | 'damage';

/**
 * Parsed condition information from action description
 */
export interface ParsedCondition {
	condition: string;
	context: ConditionContext;
	escapeDC?: number;
	escapeType?: ParsedSaveType;
}

/**
 * Parsed damage information from action
 */
export interface ParsedDamage {
	formula: string;
	damageType: string;
}

/**
 * Parsed range/reach information
 */
export interface ParsedRangeReach {
	type: 'reach' | 'range' | 'cone' | 'line' | 'burst';
	distance: number;
	width?: number;
}
