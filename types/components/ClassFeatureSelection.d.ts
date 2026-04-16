import type { NimbleFeatureItem } from '#documents/item/feature.js';

/**
 * A selection group offered at a given level, with the number of features
 * the player must pick from it.
 */
export interface SelectionGroup {
	features: NimbleFeatureItem[];
	selectionCount: number;
}

export interface ClassFeatureResult {
	autoGrant: NimbleFeatureItem[];
	selectionGroups: Map<string, SelectionGroup>;
}

export interface ClassFeatureSelectionProps {
	active: boolean;
	classFeatures: ClassFeatureResult | null;
	selectedFeatures: Map<string, NimbleFeatureItem[]>;
	/** Optional override for the hint paragraph shown above the selection cards. */
	hintText?: string;
}

export interface FeatureCardProps {
	feature: NimbleFeatureItem;
	isSelected?: boolean;
	isDisabled?: boolean;
	onSelect?: () => void;
}

export interface FeatureGroupSelectionProps {
	groupName: string;
	features: NimbleFeatureItem[];
	selectionCount: number;
	selectedFeatures: NimbleFeatureItem[];
	onSelect: (feature: NimbleFeatureItem) => void;
}

export interface LevelUpClassFeatureSelectionProps {
	classFeatures: ClassFeatureResult | null;
	selectedFeatures: Map<string, NimbleFeatureItem[]>;
	loading?: boolean;
}

/**
 * Represents a part of a feature description after parsing
 */
export interface DescriptionPart {
	type: 'text' | 'spell';
	content: string;
	spell?: Item;
}

/**
 * Represents a matched spell UUID in a description
 */
export interface SpellUuidMatch {
	uuid: string;
	start: number;
	end: number;
}
