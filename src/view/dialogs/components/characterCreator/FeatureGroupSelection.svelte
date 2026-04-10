<script lang="ts">
	import type { FeatureGroupSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import { createFeatureGroupSelectionState } from './FeatureGroupSelection.svelte.ts';
	import FeatureCard from './FeatureCard.svelte';
	import localize from '#utils/localize.js';

	let { groupName, features, selectedFeature, onSelect }: FeatureGroupSelectionProps = $props();

	const state = createFeatureGroupSelectionState(() => ({ groupName, features }));

	// Selection is complete when a feature is selected and it's not a single-option group
	const isSelectionComplete = $derived(!!selectedFeature && !state.isSingleOption);

	// Filter to show only selected feature when selection is complete
	const displayedFeatures = $derived(
		isSelectionComplete ? features.filter((f) => f.uuid === selectedFeature?.uuid) : features,
	);
</script>

<div class="feature-group">
	<header class="feature-group__header">
		<h4 class="nimble-heading" data-heading-variant="section">
			{state.formattedGroupName}
		</h4>
		{#if !state.isSingleOption && !isSelectionComplete}
			<span class="feature-group__hint">{localize('NIMBLE.classFeatureSelection.chooseOne')}</span>
		{/if}
	</header>

	<ul class="feature-group__list">
		{#each displayedFeatures as feature (feature.uuid)}
			<FeatureCard
				{feature}
				isSelected={state.isSingleOption ? false : selectedFeature?.uuid === feature.uuid}
				onSelect={state.isSingleOption ? undefined : () => onSelect(feature)}
			/>
		{/each}
	</ul>
</div>

<style lang="scss">
	.feature-group {
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
