import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Creates reactive state for the LevelUpClassFeatureSelection component.
 *
 * Handles auto-selection of fixed groups, feature toggling with multi-select
 * support, and derived visibility flags.
 */
export function createClassFeatureSelectionState(
	getClassFeatures: () => ClassFeatureResult | null,
	getSelectedFeatures: () => Map<string, NimbleFeatureItem[]>,
	setSelectedFeatures: (features: Map<string, NimbleFeatureItem[]>) => void,
) {
	// Auto-select features for groups where the only available options already
	// match the required selection count (e.g., "choose 1 of 1", or "choose 2 of 2").
	$effect(() => {
		const classFeatures = getClassFeatures();
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(getSelectedFeatures());
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
		const classFeatures = getClassFeatures();
		const group = classFeatures?.selectionGroups.get(groupName);
		if (!group) return;

		const currentSelections = getSelectedFeatures().get(groupName) ?? [];
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

		const newMap = new Map(getSelectedFeatures());
		if (nextSelections.length === 0) {
			newMap.delete(groupName);
		} else {
			newMap.set(groupName, nextSelections);
		}

		setSelectedFeatures(newMap);
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
