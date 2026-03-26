import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

export interface ClassFeatureSelectionState {
	classFeatures: ClassFeatureResult | null;
	selectedFeatures: Map<string, NimbleFeatureItem>;
}

/**
 * Creates reactive state for the ClassFeatureSelection component
 *
 * @param getState - Getter function that returns the current state
 * @param setSelectedFeatures - Setter function to update selected features
 * @returns Object containing derived state and actions
 */
export function createClassFeatureSelectionState(
	getState: () => ClassFeatureSelectionState,
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem>) => void,
) {
	// Auto-select features for groups that only have one option
	$effect(() => {
		const { classFeatures, selectedFeatures } = getState();
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(selectedFeatures);
		let hasChanges = false;

		for (const [groupName, features] of classFeatures.selectionGroups) {
			if (features.length === 1 && !newSelections.has(groupName)) {
				newSelections.set(groupName, features[0]);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			setSelectedFeatures(newSelections);
		}
	});

	function handleFeatureSelect(groupName: string, feature: NimbleFeatureItem) {
		const { selectedFeatures } = getState();
		const newSelections = new Map(selectedFeatures);

		if (newSelections.get(groupName)?.uuid === feature.uuid) {
			newSelections.delete(groupName);
		} else {
			newSelections.set(groupName, feature);
		}

		setSelectedFeatures(newSelections);
	}

	function clearSelections() {
		setSelectedFeatures(new Map());
	}

	return {
		get hasAutoGrant() {
			return (getState().classFeatures?.autoGrant?.length ?? 0) > 0;
		},
		get hasSelectionGroups() {
			return (getState().classFeatures?.selectionGroups?.size ?? 0) > 0;
		},
		get hasAnyFeatures() {
			const { classFeatures } = getState();
			const hasAuto = (classFeatures?.autoGrant?.length ?? 0) > 0;
			const hasSelection = (classFeatures?.selectionGroups?.size ?? 0) > 0;
			return hasAuto || hasSelection;
		},
		handleFeatureSelect,
		clearSelections,
	};
}
