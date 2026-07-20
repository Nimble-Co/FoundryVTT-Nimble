import type { NimbleFeatureItem } from '#documents/item/feature.js';
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

interface FeatureGroupSelectionStateProps {
	groupName: string;
	features: NimbleFeatureItem[];
	selectionCount: number;
	selectedFeatures: NimbleFeatureItem[];
	selectionMax?: number;
}

/**
 * Creates reactive state for the FeatureGroupSelection component
 *
 * @param getProps - Getter function that returns the current props
 * @returns Object containing derived state
 */
export function createFeatureGroupSelectionState(getProps: () => FeatureGroupSelectionStateProps) {
	return {
		get formattedGroupName() {
			return formatGroupName(getProps().groupName);
		},
		/**
		 * A group is "fixed" when the only available options exactly match the required
		 * count — nothing to choose, every card is granted. We still render the cards
		 * (so players can read them), but we skip the selection hint and make each card
		 * non-interactive since the outcome is predetermined.
		 */
		get isFixed() {
			const { features, selectionCount } = getProps();
			return features.length === selectionCount;
		},
		/** Upper bound on selections; defaults to the required count (an exact choice). */
		get maxSelectionCount() {
			const { selectionCount, selectionMax } = getProps();
			return selectionMax ?? selectionCount;
		},
		/** True when more selections are allowed than required (e.g. a duplicate-source choice). */
		get isRange() {
			return this.maxSelectionCount > getProps().selectionCount;
		},
		get selectedCount() {
			return getProps().selectedFeatures.length;
		},
		get isComplete() {
			const { selectionCount, selectedFeatures } = getProps();
			return selectedFeatures.length >= selectionCount;
		},
		get displayedFeatures() {
			const { features, selectedFeatures } = getProps();

			// Range groups keep every candidate visible so the player can still add or swap
			// copies after reaching the minimum; exact groups collapse to the final picks.
			if (this.isFixed || this.isRange || !this.isComplete) {
				return sortDocumentsByName(features);
			}

			return sortDocumentsByName(selectedFeatures);
		},
		isFeatureSelected(feature: NimbleFeatureItem) {
			return getProps().selectedFeatures.some((f) => f.uuid === feature.uuid);
		},
	};
}
