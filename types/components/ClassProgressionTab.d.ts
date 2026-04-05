import type { NimbleFeatureItem } from '#documents/item/feature.js';

/**
 * Data for a single level in the class progression
 */
export interface ClassProgressionLevelData {
	level: number;
	autoGrant: NimbleFeatureItem[];
	selectionGroups: Map<string, NimbleFeatureItem[]>;
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
	system: { parentClass: string };
}
