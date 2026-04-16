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
	// Auto-select features for groups where the only available options already
	// match the required selection count (e.g., "choose 1 of 1", or "choose 2 of 2").
	$effect(() => {
		const { classFeatures, selectedFeatures } = getState();
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(selectedFeatures);
		let hasChanges = false;

		for (const [groupName, group] of classFeatures.selectionGroups) {
			if (newSelections.has(groupName)) continue;

			if (group.features.length === group.selectionCount) {
				newSelections.set(groupName, [...group.features]);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			setSelectedFeatures(newSelections);
		}
	});

	function handleFeatureSelect(groupName: string, feature: NimbleFeatureItem) {
		const { classFeatures, selectedFeatures } = getState();
		const group = classFeatures?.selectionGroups.get(groupName);
		if (!group) return;

		const currentSelections = selectedFeatures.get(groupName) ?? [];
		const alreadySelectedIndex = currentSelections.findIndex((f) => f.uuid === feature.uuid);

		let nextSelections: NimbleFeatureItem[];

		if (alreadySelectedIndex !== -1) {
			// Toggle off
			nextSelections = currentSelections.filter((_, i) => i !== alreadySelectedIndex);
		} else if (currentSelections.length >= group.selectionCount) {
			// Already at cap — ignore the click
			return;
		} else {
			nextSelections = [...currentSelections, feature];
		}

		const newMap = new Map(selectedFeatures);
		if (nextSelections.length === 0) {
			newMap.delete(groupName);
		} else {
			newMap.set(groupName, nextSelections);
		}

		setSelectedFeatures(newMap);
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
