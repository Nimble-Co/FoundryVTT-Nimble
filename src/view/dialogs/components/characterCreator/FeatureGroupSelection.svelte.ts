import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	FeatureGroupSelectionProps,
	SelectionGroup,
} from '#types/components/ClassFeatureSelection.d.ts';
import getEffectiveSelectionMax from '#utils/getEffectiveSelectionMax.ts';
import sortDocumentsByName from '#utils/sortDocumentsByName.js';

/**
 * Converts kebab-case to Title Case
 * e.g., "thrill-of-the-hunt" -> "Thrill Of The Hunt"
 */
export function formatGroupName(name: string): string {
	return name
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

type FeatureGroupSelectionStateProps = Pick<
	FeatureGroupSelectionProps,
	'groupName' | 'group' | 'selectedFeatures'
>;

/**
 * A group is "fixed" when the only available options exactly match the required count — nothing
 * to choose, every card is granted.
 */
function isFixedGroup(group: SelectionGroup): boolean {
	return group.features.length === group.selectionCount;
}

/**
 * True when more selections are allowed than required — a duplicate-source group, where the
 * player keeps at least one copy and may keep more.
 */
function isRangeGroup(group: SelectionGroup): boolean {
	return getEffectiveSelectionMax(group) > group.selectionCount;
}

/**
 * Creates reactive state for the FeatureGroupSelection component
 *
 * @param getProps - Getter function that returns the current props
 * @returns Object containing derived state
 */
export function createFeatureGroupSelectionState(getProps: () => FeatureGroupSelectionStateProps) {
	return {
		/** Heading for the group: the group's own display name, else the formatted key. */
		get heading() {
			const { groupName, group } = getProps();
			return group.displayName || formatGroupName(groupName);
		},
		/**
		 * Fixed groups still render their cards (so players can read them), but skip the
		 * selection hint and are non-interactive since the outcome is predetermined.
		 */
		get isFixed() {
			return isFixedGroup(getProps().group);
		},
		/** Upper bound on selections; defaults to the required count (an exact choice). */
		get maxSelectionCount() {
			return getEffectiveSelectionMax(getProps().group);
		},
		get isRange() {
			return isRangeGroup(getProps().group);
		},
		get selectedCount() {
			return getProps().selectedFeatures.length;
		},
		get isComplete() {
			const { group, selectedFeatures } = getProps();
			return selectedFeatures.length >= group.selectionCount;
		},
		get displayedFeatures() {
			const { group, selectedFeatures } = getProps();
			const isComplete = selectedFeatures.length >= group.selectionCount;

			// Range groups keep every candidate visible so the player can still add or swap
			// copies after reaching the minimum; exact groups collapse to the final picks.
			if (isFixedGroup(group) || isRangeGroup(group) || !isComplete) {
				return sortDocumentsByName(group.features);
			}

			return sortDocumentsByName(selectedFeatures);
		},
		isFeatureSelected(feature: NimbleFeatureItem) {
			return getProps().selectedFeatures.some((f) => f.uuid === feature.uuid);
		},
	};
}
