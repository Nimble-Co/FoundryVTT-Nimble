import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	FeatureGroupSelectionProps,
	SelectionGroup,
} from '#types/components/ClassFeatureSelection.d.ts';
import localize from '#utils/localize.js';
import sortDocumentsByName from '#utils/sortDocumentsByName.js';
import {
	getEffectiveSelectionMax,
	isFixedGroup,
	isGroupComplete,
	isRangeGroup,
} from '../../selectionGroupRules.ts';

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
 * The "what am I being asked for" line: how many picks this group wants. Fixed groups ask for
 * nothing, so they get no hint.
 */
function buildHintText(group: SelectionGroup): string | null {
	if (isFixedGroup(group)) return null;

	if (isRangeGroup(group)) {
		return localize('NIMBLE.classFeatureSelection.duplicateSourceHint', {
			count: String(getEffectiveSelectionMax(group)),
		});
	}

	if (group.selectionCount === 1) {
		return localize('NIMBLE.classFeatureSelection.chooseOne');
	}

	return localize('NIMBLE.classFeatureSelection.chooseN', {
		count: String(group.selectionCount),
	});
}

/** The "where am I up to" counter that pairs with {@link buildHintText}. */
function buildProgressText(
	group: SelectionGroup,
	selectedFeatures: NimbleFeatureItem[],
): string | null {
	if (isFixedGroup(group)) return null;

	// A range group's upper bound is optional, so "of N selected" would read as a requirement.
	if (isRangeGroup(group)) {
		return localize('NIMBLE.classFeatureSelection.nOfMKept', {
			current: String(selectedFeatures.length),
			max: String(getEffectiveSelectionMax(group)),
		});
	}

	return localize('NIMBLE.classFeatureSelection.nOfMSelected', {
		current: String(selectedFeatures.length),
		required: String(group.selectionCount),
	});
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
		get isComplete() {
			const { group, selectedFeatures } = getProps();
			return isGroupComplete(group, selectedFeatures);
		},
		/** How many picks this group asks for; `null` for fixed groups, which ask for none. */
		get hintText() {
			return buildHintText(getProps().group);
		},
		/** How many picks the player has made so far; `null` for fixed groups. */
		get progressText() {
			const { group, selectedFeatures } = getProps();
			return buildProgressText(group, selectedFeatures);
		},
		get displayedFeatures() {
			const { group, selectedFeatures } = getProps();

			// Fixed groups have nothing to collapse, and range groups keep every candidate
			// visible so the player can still add or swap copies after reaching the minimum;
			// exact groups collapse to the final picks once complete.
			if (isFixedGroup(group) || isRangeGroup(group) || !isGroupComplete(group, selectedFeatures)) {
				return sortDocumentsByName(group.features);
			}

			return sortDocumentsByName(selectedFeatures);
		},
		isFeatureSelected(feature: NimbleFeatureItem) {
			return getProps().selectedFeatures.some((f) => f.uuid === feature.uuid);
		},
	};
}
