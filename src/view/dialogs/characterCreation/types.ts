import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

// Type alias for origin items - these are dynamic Foundry types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OriginItem = any;

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
	ancestryOptions: Promise<Record<'core' | 'exotic', OriginItem[]>>;
	backgroundOptions: Promise<OriginItem[]>;
	bonusLanguageOptions: Array<{ value: string; label: string; tooltip: string }>;
	classOptions: Promise<OriginItem[]>;
	dialog: CharacterCreationDialogInstance;
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
		background?: OriginItem;
		characterClass?: OriginItem;
		ancestry?: OriginItem;
	};
	classFeatures?: {
		autoGrant: string[];
		selected: Map<string, NimbleFeatureItem>;
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

/**
 * Re-export types from other modules for convenience
 */
export type { ClassFeatureResult, NimbleFeatureItem };
