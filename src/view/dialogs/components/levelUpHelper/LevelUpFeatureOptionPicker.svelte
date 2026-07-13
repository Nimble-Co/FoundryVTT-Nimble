<script lang="ts">
	import type { LevelUpFeatureOptionPickerProps } from '#types/components/ClassFeatureSelection.d.ts';

	import FeatureCard from '../characterCreator/FeatureCard.svelte';
	import FeatureGroupSelection from '../characterCreator/FeatureGroupSelection.svelte';
	import localize from '#utils/localize.js';
	import { createFeatureOptionPickerState } from './LevelUpFeatureOptionPicker.svelte.ts';

	let {
		feature,
		levelingTo,
		selectedOptionId,
		selectedSubItemUuids,
		ownedItemUuids,
		onSelect,
		onSubItemSelect,
	}: LevelUpFeatureOptionPickerProps = $props();

	const state = createFeatureOptionPickerState(
		() => feature,
		() => levelingTo,
		() => selectedOptionId,
		() => selectedSubItemUuids,
		() => ownedItemUuids,
		(optionId) => onSelect(optionId),
		(uuid) => onSubItemSelect(uuid),
	);

	const options = $derived(state.options);
	const isSingleOption = $derived(state.isSingleOption);
	const selectedOption = $derived(state.selectedOption);
	const subSelectionCount = $derived(state.subSelectionCount);
	const hasSubSelection = $derived(state.hasSubSelection);
	const loadedSubItems = $derived(state.loadedSubItems);
	const subItemsLoading = $derived(state.subItemsLoading);
	const selectedSubItems = $derived(state.selectedSubItems);
</script>

<div class="feature-option-picker">
	<ul class="feature-option-picker__parent">
		<FeatureCard {feature} asHeader />
	</ul>

	<div class="feature-option-picker__body">
		{#if !isSingleOption}
			<span class="feature-option-picker__hint">
				{localize('NIMBLE.classFeatureSelection.chooseOne')}
			</span>
			<ul class="feature-option-picker__list">
				{#each options as option (option.id)}
					{@const isSelected = selectedOptionId === option.id}
					<li class="option-item" class:selected={isSelected}>
						<button
							class="option-item__button"
							type="button"
							aria-pressed={isSelected}
							aria-label={isSelected
								? localize('NIMBLE.levelUpDialog.deselectOption')
								: localize('NIMBLE.levelUpDialog.selectOption')}
							onclick={() => onSelect(option.id)}
						>
							<span class="option-item__indicator">
								{#if isSelected}
									<i class="fa-solid fa-circle-check"></i>
								{:else}
									<i class="fa-regular fa-circle"></i>
								{/if}
							</span>
							<span class="option-item__label">{option.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if hasSubSelection && selectedOptionId}
			{#if subItemsLoading}
				<p class="nimble-hint sub-items-loading">
					{localize('NIMBLE.levelUpDialog.loadingFeatures')}
				</p>
			{:else if loadedSubItems.length > 0}
				<FeatureGroupSelection
					groupName={selectedOption?.selectionGroups?.join('-') ?? 'selection'}
					features={loadedSubItems}
					selectionCount={subSelectionCount}
					selectedFeatures={selectedSubItems}
					hideGroupName
					onSelect={(item) => onSubItemSelect(item.uuid)}
				/>
			{/if}
		{/if}
	</div>
</div>

<style lang="scss">
	.feature-option-picker {
		margin-top: 1rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		background: color-mix(in srgb, var(--nimble-box-background-color) 50%, transparent);

		// Parent renders as a bare header row, divided from the choices below.
		&__parent {
			margin: 0;
			padding: 0;
			list-style: none;
			border-bottom: 1px solid var(--nimble-card-border-color);
			padding-bottom: 0.5rem;
		}

		&__body {
			// Choices align flush with the header and the box's right edge (even gutters).
			margin-top: 0.5rem;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		// The nested group already sits under the body's spacing, so trim its own top gap
		// (the shared component ships a larger margin meant for stacked groups elsewhere).
		:global(.feature-group) {
			margin-top: 0.25rem;
		}

		// Give the "Choose one" hint and the "0 of 1 selected" count a little breathing room
		// from the box gutters.
		:global(.feature-group__hint),
		:global(.feature-group__progress) {
			padding-inline: 0.5rem;
		}

		&__hint {
			font-size: 0.875rem;
			font-weight: normal;
			color: var(--nimble-medium-text-color);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			margin: 0;
			padding: 0;
		}
	}

	.sub-items-loading {
		margin: 0;
	}

	.option-item {
		list-style: none;

		&__button {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			width: 100%;
			padding: 0.5rem 0.75rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			text-align: left;
			transition: all 0.2s ease;

			&:hover {
				border-color: var(--nimble-accent-color);
			}
		}

		&.selected .option-item__button {
			border-color: var(--nimble-accent-color);
			background: color-mix(
				in srgb,
				var(--nimble-accent-color) 10%,
				var(--nimble-box-background-color)
			);
		}

		&__indicator {
			font-size: 1rem;
			color: var(--nimble-accent-color);
			flex-shrink: 0;
			width: 1rem;
			text-align: center;
		}

		&__label {
			font-size: 0.9rem;
			line-height: 1.3;
		}
	}
</style>
