import type { NimbleFeatureItem } from '#documents/item/feature.js';

export interface ClassFeatureResult {
	autoGrant: NimbleFeatureItem[];
	selectionGroups: Map<string, NimbleFeatureItem[]>;
	selectionCounts: Map<string, number>;
}

export interface ClassFeatureSelectionProps {
	active: boolean;
	classFeatures: ClassFeatureResult | null;
	selectedFeatures: Map<string, NimbleFeatureItem[]>;
}

export interface FeatureCardProps {
	feature: NimbleFeatureItem;
	isSelected?: boolean;
	onSelect?: () => void;
}

export interface FeatureGroupSelectionProps {
	groupName: string;
	features: NimbleFeatureItem[];
	selectedFeatures: NimbleFeatureItem[];
	maxSelections: number;
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
