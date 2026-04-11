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
	getSelectedFeatures: () => Map<string, NimbleFeatureItem[]>,
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem[]>) => void,
) {
	// Auto-select features for groups where available options equal the required count
	$effect(() => {
		const classFeatures = getClassFeatures();
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(getSelectedFeatures());
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
		const classFeatures = getClassFeatures();
		const newSelections = new Map(getSelectedFeatures());
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
