<script lang="ts">
	import type { NimbleFeatureItem } from '#documents/item/feature.js';
	import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

	import { createFeatureOptionPickerState } from '../../src/view/dialogs/components/levelUpHelper/LevelUpFeatureOptionPicker.svelte.ts';

	let {
		feature,
		levelingTo,
		selectedOptionId = null,
		selectedSubItemUuids = [],
		ownedItemUuids = new Set<string>(),
		classFeatureIndex = null,
		onSelect,
		onSubItemSelect,
	}: {
		feature: NimbleFeatureItem;
		levelingTo: number;
		selectedOptionId?: string | null;
		selectedSubItemUuids?: string[];
		ownedItemUuids?: Set<string>;
		classFeatureIndex?: ClassFeatureIndex | null;
		onSelect: (optionId: string) => void;
		onSubItemSelect: (uuid: string) => void;
	} = $props();

	const state = createFeatureOptionPickerState(
		() => feature,
		() => levelingTo,
		() => selectedOptionId,
		() => selectedSubItemUuids,
		() => ownedItemUuids,
		() => classFeatureIndex,
		(optionId) => onSelect(optionId),
		(uuid) => onSubItemSelect(uuid),
	);

	const optionCount = $derived(state.options.length);
	const isSingleOption = $derived(state.isSingleOption);
	const hasSubSelection = $derived(state.hasSubSelection);
	const subItemsLoading = $derived(state.subItemsLoading);
	const loadedCount = $derived(state.loadedSubItems.length);
</script>

<div data-testid="option-count">{optionCount}</div>
<div data-testid="is-single">{String(isSingleOption)}</div>
<div data-testid="has-sub-selection">{String(hasSubSelection)}</div>
<div data-testid="loading">{String(subItemsLoading)}</div>
<div data-testid="loaded-count">{loadedCount}</div>
