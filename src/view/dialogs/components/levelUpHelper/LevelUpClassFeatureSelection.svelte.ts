import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Creates reactive state for the LevelUpClassFeatureSelection component.
 *
 * Handles auto-selection of single-option groups, feature toggling,
 * and derived visibility flags.
 */
export function createClassFeatureSelectionState(
	getClassFeatures: () => ClassFeatureResult | null,
	getSelectedFeatures: () => Map<string, NimbleFeatureItem>,
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem>) => void,
) {
	// Auto-select features for groups that only have one option
	$effect(() => {
		const classFeatures = getClassFeatures();
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(getSelectedFeatures());
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
		const newSelections = new Map(getSelectedFeatures());

		if (newSelections.get(groupName)?.uuid === feature.uuid) {
			newSelections.delete(groupName);
		} else {
			newSelections.set(groupName, feature);
		}

		setSelectedFeatures(newSelections);
	}

	const hasAutoGrant = $derived((getClassFeatures()?.autoGrant?.length ?? 0) > 0);
	const hasSelectionGroups = $derived((getClassFeatures()?.selectionGroups?.size ?? 0) > 0);
	const hasAnyFeatures = $derived(hasAutoGrant || hasSelectionGroups);

	return {
		get hasAutoGrant() {
			return hasAutoGrant;
		},
		get hasSelectionGroups() {
			return hasSelectionGroups;
		},
		get hasAnyFeatures() {
			return hasAnyFeatures;
		},
		handleFeatureSelect,
	};
}
