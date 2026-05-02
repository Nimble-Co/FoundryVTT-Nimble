import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Data for a single level in the class progression
 */
export interface ClassProgressionLevelData {
	level: number;
	autoGrant: NimbleFeatureItem[];
	selectionGroups: Map<string, SelectionGroup>;
}

/**
 * Ability score data entry from the class model
 */
export interface AbilityScoreDataEntry {
	value: string;
	type: 'statIncrease' | 'boon';
	statIncreaseType: 'primary' | 'secondary' | 'capstone';
}

/**
 * Props for the ClassProgressionLevelRow component
 */
export interface ClassProgressionLevelRowProps {
	level: number;
	levelData: ClassProgressionLevelData;
	abilityScoreEntry: AbilityScoreDataEntry | null;
	isSubclassLevel: boolean;
	classIdentifier: string;
	className: string;
	keyAbilityScores: string[];
	onFeatureClick: (feature: NimbleFeatureItem) => void;
	onAddFeature: (level: number, classIdentifier: string) => void;
}

/**
 * Subclass choice data
 */
export interface SubclassChoice {
	uuid: string;
	name: string;
	img: string;
	description: string;
	identifier: string;
	system: { parentClass: string };
}
