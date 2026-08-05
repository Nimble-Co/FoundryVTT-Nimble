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
	 * exact choice). When greater than `selectionCount` the group is a *range* — currently only
	 * duplicate-source groups, where the player may pick one source or keep every copy. The
	 * range is what drives the "choose one, or keep all" hint — whose wording assumes
	 * `selectionCount` is 1, so revisit that string before shipping a range with a higher
	 * minimum.
	 */
	selectionMax?: number;
	/**
	 * Candidates that share their identity with another candidate in the group, so each needs a
	 * "World" / "Pack" badge to be told apart. Candidates with no twin are left unbadged.
	 */
	duplicatedSourceUuids?: ReadonlySet<string>;
	/** Heading to display verbatim instead of formatting the group key (e.g. a feature name). */
	displayName?: string;
	/**
	 * Candidates the character already owns. They appear in `features` so a new copy can be
	 * compared against the one on the sheet, but they can never be selected — they are already
	 * granted. Their presence is also what lets `selectionCount` be 0: keeping only what you
	 * already have is a valid outcome.
	 */
	ownedUuids?: ReadonlySet<string>;
	/**
	 * Candidate to mark as recommended, and to start the group on when at least one copy has to
	 * be kept. Never an owned copy.
	 */
	recommendedUuid?: string;
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
	/** Show a "World" / "Pack" badge indicating where this feature is sourced from. */
	showSourceLabel?: boolean;
}

export interface FeatureGroupSelectionProps {
	/** Key the group is stored under, used as the heading when it has no `displayName`. */
	groupName: string;
	/** The group to render, carrying its candidates, selection bounds, and display options. */
	group: SelectionGroup;
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
