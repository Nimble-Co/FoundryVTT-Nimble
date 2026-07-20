import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import isLevelUpOptionApplicable from '#utils/isLevelUpOptionApplicable.ts';

import loadOptionSubItems from './LevelUpFeatureOptionPicker.utils.ts';

/**
 * Creates reactive state for the LevelUpFeatureOptionPicker component.
 *
 * Derives the level-applicable options, auto-selects the sole option when only one
 * applies, lazily loads the selected option's sub-item pool from the packs, and
 * auto-selects sub-items when the available count exactly matches the required count.
 */
export function createFeatureOptionPickerState(
	getFeature: () => NimbleFeatureItem,
	getLevelingTo: () => number,
	getSelectedOptionId: () => string | null,
	getSelectedSubItemUuids: () => string[],
	getOwnedItemUuids: () => ReadonlySet<string>,
	getClassFeatureIndex: () => ClassFeatureIndex | null,
	onSelect: (optionId: string) => void,
	onSubItemSelect: (uuid: string) => void,
) {
	const options = $derived(
		(getFeature().system.levelUpOptions ?? []).filter((opt) =>
			isLevelUpOptionApplicable(opt, getLevelingTo()),
		),
	);
	const isSingleOption = $derived(options.length === 1);
	const selectedOption = $derived(options.find((o) => o.id === getSelectedOptionId()) ?? null);
	const subSelectionCount = $derived(selectedOption?.selectionCount ?? 1);
	const hasSubSelection = $derived((selectedOption?.selectionGroups?.length ?? 0) > 0);

	$effect(() => {
		if (isSingleOption && getSelectedOptionId() !== options[0].id) {
			onSelect(options[0].id);
		}
	});

	let loadedSubItems = $state<NimbleFeatureItem[]>([]);
	let subItemsLoading = $state(false);

	$effect(() => {
		const option = selectedOption;
		const owned = getOwnedItemUuids();
		const classId = getFeature().system.class;
		const index = getClassFeatureIndex();

		if (!option?.selectionGroups?.length) {
			loadedSubItems = [];
			subItemsLoading = false;
			return;
		}

		subItemsLoading = true;
		loadOptionSubItems(index, classId, option.selectionGroups, owned)
			.then((items) => {
				loadedSubItems = items;
				subItemsLoading = false;
			})
			.catch(() => {
				subItemsLoading = false;
			});
	});

	const selectedSubItems = $derived(
		loadedSubItems.filter((i) => getSelectedSubItemUuids().includes(i.uuid ?? '')),
	);

	// Auto-select the sub-item(s) when the number of available choices exactly matches the
	// required count — e.g. the last remaining Weapon Mastery at level 14. The player shouldn't
	// have to click the only option left. Mirrors the auto-select behaviour of fixed selection
	// groups (createClassFeatureSelectionState), and the guard against already-selected uuids
	// prevents the effect from looping once the selection has been applied.
	$effect(() => {
		if (subItemsLoading) return;
		if (loadedSubItems.length === 0) return;
		if (loadedSubItems.length !== subSelectionCount) return;
		const selected = getSelectedSubItemUuids();
		for (const item of loadedSubItems) {
			if (!selected.includes(item.uuid ?? '')) onSubItemSelect(item.uuid ?? '');
		}
	});

	return {
		get options() {
			return options;
		},
		get isSingleOption() {
			return isSingleOption;
		},
		get selectedOption() {
			return selectedOption;
		},
		get subSelectionCount() {
			return subSelectionCount;
		},
		get hasSubSelection() {
			return hasSubSelection;
		},
		get loadedSubItems() {
			return loadedSubItems;
		},
		get subItemsLoading() {
			return subItemsLoading;
		},
		get selectedSubItems() {
			return selectedSubItems;
		},
	};
}
