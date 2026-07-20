import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/**
 * A selection group offered at a given level, with the number of features
 * the player must pick from it.
 */
export interface SelectionGroup {
	features: NimbleFeatureItem[];
	/** Minimum number of features that must be selected from the group. */
	selectionCount: number;
	/**
	 * Maximum number of features that may be selected. Defaults to `selectionCount` (an
	 * exact choice). When greater than `selectionCount` the group is a range — used by
	 * duplicate-source groups so the player can pick a single source or keep every copy.
	 */
	selectionMax?: number;
	/**
	 * True when the group represents the same class feature offered from more than one source
	 * (a customized World Item plus its Compendium original). Drives the "choose one or keep
	 * both" hint and shows a source badge on each candidate.
	 */
	isDuplicateChoice?: boolean;
	/** Show a source badge on each candidate without changing the group's selection hint. */
	showSourceLabel?: boolean;
	/** Heading to display verbatim instead of formatting the group key (e.g. a feature name). */
	displayName?: string;
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
	/** Show a "World Item" / "Compendium" badge indicating where this feature is sourced from. */
	showSourceLabel?: boolean;
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
	/** Maximum selectable features; defaults to `selectionCount`. */
	selectionMax?: number;
	/** Present the group as a same-feature multiple-source choice ("choose one or keep both"). */
	isDuplicateChoice?: boolean;
	/** Show a source badge on each candidate without changing the selection hint. */
	showSourceLabel?: boolean;
	/** Heading to display verbatim instead of formatting the group key. */
	displayName?: string;
}

export interface LevelUpFeatureOptionPickerProps {
	feature: NimbleFeatureItem;
	levelingTo: number;
	selectedOptionId: string | null;
	selectedSubItemUuids: string[];
	ownedItemUuids: Set<string>;
	/** Pre-built class-feature index, reused to resolve the option's sub-item pool. */
	classFeatureIndex: ClassFeatureIndex | null;
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
	/** Pre-built class-feature index, forwarded to each option picker for sub-item lookups. */
	classFeatureIndex: ClassFeatureIndex | null;
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
