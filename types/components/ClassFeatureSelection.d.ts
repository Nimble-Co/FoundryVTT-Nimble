import type { NimbleFeatureItem } from '#documents/item/feature.js';

export interface ClassFeatureResult {
	autoGrant: NimbleFeatureItem[];
	selectionGroups: Map<string, NimbleFeatureItem[]>;
}

export interface ClassFeatureSelectionProps {
	active: boolean;
	classFeatures: ClassFeatureResult | null;
	selectedFeatures: Map<string, NimbleFeatureItem>;
}

export interface FeatureCardProps {
	feature: NimbleFeatureItem;
	isSelected?: boolean;
	onSelect?: () => void;
}

export interface FeatureGroupSelectionProps {
	groupName: string;
	features: NimbleFeatureItem[];
	selectedFeature: NimbleFeatureItem | null;
	onSelect: (feature: NimbleFeatureItem) => void;
}
