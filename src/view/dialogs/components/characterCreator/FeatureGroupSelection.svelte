<script lang="ts">
	import type { FeatureGroupSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import { createFeatureGroupSelectionState } from './FeatureGroupSelection.svelte.ts';
	import FeatureCard from './FeatureCard.svelte';
	import localize from '#utils/localize.js';

	let {
		groupName,
		group,
		selectedFeatures,
		onSelect,
		hideGroupName = false,
	}: FeatureGroupSelectionProps = $props();

	const state = createFeatureGroupSelectionState(() => ({
		groupName,
		group,
		selectedFeatures,
	}));

	function getHintText() {
		if (state.isFixed) return null;

		if (state.isRange) {
			return localize('NIMBLE.classFeatureSelection.duplicateSourceHint', {
				count: String(state.maxSelectionCount),
			});
		}

		if (group.selectionCount === 1) {
			return localize('NIMBLE.classFeatureSelection.chooseOne');
		}

		return localize('NIMBLE.classFeatureSelection.chooseN', {
			count: String(group.selectionCount),
		});
	}

	function getProgressText() {
		if (state.isFixed) return null;

		// A range group's upper bound is optional, so "of N selected" would read as a requirement.
		if (state.isRange) {
			return localize('NIMBLE.classFeatureSelection.nOfMKept', {
				current: String(state.selectedCount),
				max: String(state.maxSelectionCount),
			});
		}

		return localize('NIMBLE.classFeatureSelection.nOfMSelected', {
			current: String(state.selectedCount),
			required: String(group.selectionCount),
		});
	}
</script>

<div class="feature-group">
	<header class="feature-group__header">
		{#if !hideGroupName}
			<h4 class="nimble-heading" data-heading-variant="section">
				{state.heading}
			</h4>
		{/if}
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
				showSourceLabel={group.showSourceLabel ?? false}
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
