import type { NimbleFeatureItem } from '#documents/item/feature.js';

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
		get selectedCount() {
			return getProps().selectedFeatures.length;
		},
		get isComplete() {
			const { selectionCount, selectedFeatures } = getProps();
			return selectedFeatures.length >= selectionCount;
		},
		get displayedFeatures() {
			const { features, selectionCount, selectedFeatures } = getProps();
			const isFixed = features.length === selectionCount;
			const isComplete = selectedFeatures.length >= selectionCount;

			if (isFixed || !isComplete) {
				return features;
			}

			return selectedFeatures;
		},
		isFeatureSelected(feature: NimbleFeatureItem) {
			return getProps().selectedFeatures.some((f) => f.uuid === feature.uuid);
		},
	};
}
