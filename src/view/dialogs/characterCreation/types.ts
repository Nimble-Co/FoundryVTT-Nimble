import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.js';
import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';

/**
 * Union type for origin items used in character creation.
 * These are the item types that define a character's origins.
 */
export type OriginItem = NimbleClassItem | NimbleAncestryItem | NimbleBackgroundItem | null;

/**
 * Source of spell grants
 */
export type SpellGrantSource = 'class' | 'background';

/**
 * Represents a group of spells that requires school selection
 */
export interface SchoolSelectionGroup {
	ruleId: string;
	label: string;
	availableSchools: string[];
	tiers: number[];
	count: number;
	utilityOnly: boolean;
	forClass: string;
	source: SpellGrantSource;
}

/**
 * Represents a group of spells that requires individual spell selection
 */
export interface SpellSelectionGroup {
	ruleId: string;
	label: string;
	availableSpells: SpellIndexEntry[];
	count: number;
	utilityOnly: boolean;
	forClass: string;
	source: SpellGrantSource;
}

/**
 * Result of extracting spell grants from class features
 */
export interface SpellGrantResult {
	autoGrant: SpellIndexEntry[];
	schoolSelections: SchoolSelectionGroup[];
	spellSelections: SpellSelectionGroup[];
	hasGrants: boolean;
}

/**
 * Represents a language granted by ancestry or background rules
 */
export interface GrantedLanguage {
	key: string;
	source: 'ancestry' | 'background';
}

/**
 * Props passed to the CharacterCreationDialog Svelte component
 */
export interface CharacterCreationDialogProps {
	ancestryOptions: Promise<Record<'core' | 'exotic', NimbleAncestryItem[]>>;
	backgroundOptions: Promise<NimbleBackgroundItem[]>;
	bonusLanguageOptions: Array<{ value: string; label: string; tooltip: string }>;
	classFeatureIndex: Promise<ClassFeatureIndex>;
	classOptions: Promise<NimbleClassItem[]>;
	dialog: CharacterCreationDialogInstance;
	spellIndex: Promise<SpellIndex>;
	statArrayOptions: StatArrayOption[];
}

/**
 * A stat array option for character creation
 */
export interface StatArrayOption {
	key: string;
	array: number[];
	name: string;
}

/**
 * Interface for the CharacterCreationDialog class instance
 */
export interface CharacterCreationDialogInstance {
	id: string;
	submitCharacterCreation: (results: CharacterCreationResults) => Promise<void>;
}

/**
 * Results submitted when character creation is complete
 */
export interface CharacterCreationResults {
	name?: string;
	sizeCategory?: string;
	selectedAncestrySave?: string | null;
	selectedRaisedByAncestry?: { language: string; label: string } | null;
	abilityScores?: Record<string, number>;
	skills?: Record<string, number>;
	languages?: string[];
	startingEquipmentChoice?: 'equipment' | 'gold';
	origins?: {
		background?: NimbleBackgroundItem;
		characterClass?: NimbleClassItem;
		ancestry?: NimbleAncestryItem;
	};
	classFeatures?: {
		autoGrant: string[];
		selected: Map<string, NimbleFeatureItem[]>;
	};
	spells?: {
		autoGrant: string[];
		selectedSchools: Map<string, string[]>;
		/** Directly selected spell UUIDs (from selectSpell mode) */
		selectedSpells: Map<string, string[]>;
		/** Filtering options for each school selection rule */
		selectionOptions: Map<string, { utilityOnly: boolean; forClass: string; tiers: number[] }>;
	};
}

/**
 * Stage values type - can be a number or a string like '0b', '1a', etc.
 */
export type StageValue = number | string;

/**
 * Map of ability scores to their assigned array indices
 */
export type AbilityScoreAssignment = Record<string, number | null>;

/**
 * Map of skills to their assigned points
 */
export type SkillPointAssignment = Record<string, number>;
