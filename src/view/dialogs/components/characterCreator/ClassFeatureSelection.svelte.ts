import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

export interface ClassFeatureSelectionState {
	classFeatures: ClassFeatureResult | null;
	selectedFeatures: Map<string, NimbleFeatureItem[]>;
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
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem[]>) => void,
) {
	// Auto-select features for groups where available options equal the required count
	$effect(() => {
		const { classFeatures, selectedFeatures } = getState();
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(selectedFeatures);
		let hasChanges = false;

		for (const [groupName, features] of classFeatures.selectionGroups) {
			const maxSelections = classFeatures.selectionCounts?.get(groupName) ?? 1;
			if (features.length <= maxSelections && !newSelections.has(groupName)) {
				newSelections.set(groupName, [...features]);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			setSelectedFeatures(newSelections);
		}
	});

	function handleFeatureSelect(groupName: string, feature: NimbleFeatureItem) {
		const { selectedFeatures, classFeatures } = getState();
		const newSelections = new Map(selectedFeatures);
		const current = [...(newSelections.get(groupName) ?? [])];
		const maxSelections = classFeatures?.selectionCounts?.get(groupName) ?? 1;

		const existingIndex = current.findIndex((f) => f.uuid === feature.uuid);
		if (existingIndex >= 0) {
			current.splice(existingIndex, 1);
		} else if (current.length < maxSelections) {
			current.push(feature);
		}

		if (current.length === 0) {
			newSelections.delete(groupName);
		} else {
			newSelections.set(groupName, current);
		}

		setSelectedFeatures(newSelections);
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
	};
}
