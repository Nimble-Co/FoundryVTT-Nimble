<script lang="ts">
	import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';
	import type { NimbleFeatureItem } from '#documents/item/feature.js';

	import { getContext } from 'svelte';

	import FeatureCard from './FeatureCard.svelte';
	import FeatureGroupSelection from './FeatureGroupSelection.svelte';
	import Hint from '../../../components/Hint.svelte';

	let {
		active,
		classFeatures,
		selectedFeatures = $bindable(),
	}: {
		active: boolean;
		classFeatures: ClassFeatureResult | null;
		selectedFeatures: Map<string, NimbleFeatureItem>;
	} = $props();

	const CHARACTER_CREATION_STAGES = getContext<Record<string, string | number>>(
		'CHARACTER_CREATION_STAGES',
	);
	const dialog = getContext<{ id: string }>('dialog');

	let hasAutoGrant = $derived((classFeatures?.autoGrant?.length ?? 0) > 0);
	let hasSelectionGroups = $derived((classFeatures?.selectionGroups?.size ?? 0) > 0);
	let hasAnyFeatures = $derived(hasAutoGrant || hasSelectionGroups);

	function handleFeatureSelect(groupName: string, feature: NimbleFeatureItem) {
		const newSelections = new Map(selectedFeatures);
		if (newSelections.get(groupName)?.uuid === feature.uuid) {
			// Deselect if clicking the same feature
			newSelections.delete(groupName);
		} else {
			newSelections.set(groupName, feature);
		}
		selectedFeatures = newSelections;
	}

	function clearSelections() {
		selectedFeatures = new Map();
	}
</script>

{#if hasAnyFeatures}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.CLASS_FEATURES}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				Step 1b: Class Features

				{#if !active && hasSelectionGroups}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label="Edit Class Feature Selection"
						data-tooltip="Edit Class Feature Selection"
						onclick={clearSelections}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</h3>
		</header>

		{#if active}
			<Hint
				hintText="The following features are available at level 1 for your class. Some features are automatically granted, while others require you to make a choice."
			/>
		{/if}

		{#if hasAutoGrant}
			<div class="granted-features">
				<header class="granted-features__header">
					<h4 class="nimble-heading" data-heading-variant="section">Granted Features</h4>
					<span class="granted-features__hint">(Automatically granted)</span>
				</header>

				<ul class="granted-features__list">
					{#each classFeatures?.autoGrant ?? [] as feature (feature.uuid)}
						<FeatureCard {feature} />
					{/each}
				</ul>
			</div>
		{/if}

		{#if hasSelectionGroups}
			{#each [...(classFeatures?.selectionGroups ?? [])] as [groupName, features] (groupName)}
				<FeatureGroupSelection
					{groupName}
					{features}
					selectedFeature={selectedFeatures.get(groupName) ?? null}
					onSelect={(feature) => handleFeatureSelect(groupName, feature)}
				/>
			{/each}
		{/if}
	</section>
{/if}

<style lang="scss">
	.granted-features {
		margin-top: 1rem;

		&__header {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
			margin-bottom: 0.75rem;
		}

		&__hint {
			font-size: 0.875rem;
			font-weight: normal;
			color: var(--nimble-medium-text-color);
		}

		&__list {
			display: flex;
			flex-direction: column;
			margin: 0;
			padding: 0;
		}
	}
</style>
