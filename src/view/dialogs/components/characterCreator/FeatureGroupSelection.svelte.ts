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

/**
 * Creates reactive state for the FeatureGroupSelection component
 *
 * @param getProps - Getter function that returns the current props
 * @returns Object containing derived state
 */
export function createFeatureGroupSelectionState(
	getProps: () => { groupName: string; features: NimbleFeatureItem[]; maxSelections: number },
) {
	return {
		get formattedGroupName() {
			return formatGroupName(getProps().groupName);
		},
		get isSingleOption() {
			const { features, maxSelections } = getProps();
			return features.length <= maxSelections;
		},
	};
}
