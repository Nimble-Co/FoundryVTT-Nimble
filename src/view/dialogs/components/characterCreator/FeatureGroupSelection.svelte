<script lang="ts">
	import type { FeatureGroupSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import { createFeatureGroupSelectionState } from './FeatureGroupSelection.svelte.ts';
	import FeatureCard from './FeatureCard.svelte';
	import localize from '#utils/localize.js';

	let {
		groupName,
		features,
		selectionCount,
		selectedFeatures,
		onSelect,
	}: FeatureGroupSelectionProps = $props();

	const state = createFeatureGroupSelectionState(() => ({
		groupName,
		features,
		selectionCount,
		selectedFeatures,
	}));

	function getHintText() {
		if (state.isFixed) return null;

		if (selectionCount === 1) {
			return localize('NIMBLE.classFeatureSelection.chooseOne');
		}

		return game.i18n.format('NIMBLE.classFeatureSelection.chooseN', {
			count: selectionCount,
		});
	}

	function getProgressText() {
		if (state.isFixed) return null;

		return game.i18n.format('NIMBLE.classFeatureSelection.nOfMSelected', {
			current: state.selectedCount,
			required: selectionCount,
		});
	}
</script>

<div class="feature-group">
	<header class="feature-group__header">
		<h4 class="nimble-heading" data-heading-variant="section">
			{state.formattedGroupName}
		</h4>
		{#if !state.isFixed}
			<span class="feature-group__hint">{getHintText()}</span>
			<span
				class="feature-group__progress"
				class:feature-group__progress--complete={state.isComplete}
			>
				{getProgressText()}
			</span>
		{/if}
	</header>

	<ul class="feature-group__list">
		{#each state.displayedFeatures as feature (feature.uuid)}
			{@const isSelected = state.isFeatureSelected(feature)}
			<FeatureCard
				{feature}
				isSelected={state.isFixed ? false : isSelected}
				onSelect={state.isFixed ? undefined : () => onSelect(feature)}
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

		&__progress {
			margin-left: auto;
			font-size: 0.875rem;
			font-weight: normal;
			color: var(--nimble-medium-text-color);

			&--complete {
				color: var(--nimble-accent-color);
				font-weight: 600;
			}
		}

		&__list {
			display: flex;
			flex-direction: column;
			margin: 0;
			padding: 0;
		}
	}
</style>
