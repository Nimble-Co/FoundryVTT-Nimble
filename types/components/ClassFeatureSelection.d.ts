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
	optionFeatures: NimbleFeatureItem[];
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
	/**
	 * Render as a bare header row — no card border, background, or radius — so the card can
	 * act as the heading of a containing section instead of a nested box.
	 */
	asHeader?: boolean;
}

export interface FeatureGroupSelectionProps {
	groupName: string;
	features: NimbleFeatureItem[];
	selectionCount: number;
	selectedFeatures: NimbleFeatureItem[];
	onSelect: (feature: NimbleFeatureItem) => void;
	/**
	 * Hide the group-name heading (but keep the hint/progress). Used when the group is
	 * nested under a parent feature card that already names the group, to avoid a
	 * duplicate title.
	 */
	hideGroupName?: boolean;
}

export interface LevelUpFeatureOptionPickerProps {
	feature: NimbleFeatureItem;
	levelingTo: number;
	selectedOptionId: string | null;
	selectedSubItemUuids: string[];
	ownedItemUuids: Set<string>;
	onSelect: (optionId: string) => void;
	onSubItemSelect: (uuid: string) => void;
}

export interface LevelUpClassFeatureSelectionProps {
	classFeatures: ClassFeatureResult | null;
	levelingTo: number;
	selectedFeatures: Map<string, NimbleFeatureItem[]>;
	selectedOptionIds: Map<string, string>;
	selectedOptionSubItems: Map<string, string[]>;
	ownedItemUuids: Set<string>;
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
