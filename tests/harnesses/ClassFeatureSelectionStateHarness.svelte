<script lang="ts">
	import type { NimbleFeatureItem } from '#documents/item/feature.js';
	import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

	import { untrack } from 'svelte';

	/**
	 * Drives a class-feature selection state factory inside a component context (the factories
	 * register an `$effect`). The character-creator and level-up dialogs each own a copy of this
	 * logic with a different signature, so the caller supplies an adapter that wires whichever
	 * factory is under test to these three accessors.
	 */
	let {
		classFeatures,
		createState,
	}: {
		classFeatures: ClassFeatureResult;
		createState: (
			getClassFeatures: () => ClassFeatureResult,
			getSelectedFeatures: () => Map<string, NimbleFeatureItem[]>,
			setSelectedFeatures: (features: Map<string, NimbleFeatureItem[]>) => void,
		) => { handleFeatureSelect: (groupName: string, feature: NimbleFeatureItem) => void };
	} = $props();

	let selectedFeatures = $state<Map<string, NimbleFeatureItem[]>>(new Map());

	// The factory is fixed for the lifetime of a mount, so read it untracked — otherwise Svelte
	// warns that we're capturing only its initial value.
	const selectionState = untrack(() =>
		createState(
			() => classFeatures,
			() => selectedFeatures,
			(features) => {
				selectedFeatures = features;
			},
		),
	);

	/** Flattened `group=uuid,uuid` view so tests can assert selections as text. */
	const selectionSummary = $derived(
		[...selectedFeatures.entries()]
			.map(([groupName, features]) => `${groupName}=${features.map((f) => f.uuid).join(',')}`)
			.join('|'),
	);

	export function selectFeature(groupName: string, feature: NimbleFeatureItem) {
		selectionState.handleFeatureSelect(groupName, feature);
	}
</script>

<div data-testid="selections">{selectionSummary}</div>
