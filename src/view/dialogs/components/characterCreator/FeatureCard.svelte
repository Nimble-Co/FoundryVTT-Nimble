<script lang="ts">
	import type { FeatureCardProps } from '#types/components/ClassFeatureSelection.d.ts';
	import { createFeatureCardState } from './FeatureCard.svelte.ts';
	import SpellReferenceCard from './SpellReferenceCard.svelte';
	import localize from '#utils/localize.js';

	let { feature, isSelected = false, onSelect }: FeatureCardProps = $props();

	const state = createFeatureCardState(() => feature);

	// Whether this card is in selectable mode
	const isSelectable = $derived(!!onSelect);

	function handleRowClick() {
		// Clicking the row always toggles expansion
		state.toggleExpanded();
	}

	function handleSelectClick(e: MouseEvent) {
		e.stopPropagation(); // Prevent row click from firing
		onSelect?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleRowClick();
		}
	}
</script>

<li class="feature-item" class:expanded={state.isExpanded}>
	<div
		class="feature-row"
		class:selected={isSelected}
		class:selectable={isSelectable}
		role="button"
		tabindex="0"
		onclick={handleRowClick}
		onkeydown={handleKeydown}
	>
		<i class="fa-solid fa-chevron-down expand-arrow"></i>

		<img
			class="feature-row__img"
			src={feature.img || 'icons/svg/item-bag.svg'}
			alt={feature.name}
		/>

		<h4 class="feature-row__name nimble-heading" data-heading-variant="item">
			{feature.name}
		</h4>

		{#if isSelectable}
			<div class="feature-row__actions">
				<button
					type="button"
					class="select-button"
					class:selected={isSelected}
					onclick={handleSelectClick}
					data-tooltip={isSelected
						? localize('NIMBLE.classFeatureSelection.deselectFeature')
						: localize('NIMBLE.classFeatureSelection.selectFeature')}
					data-tooltip-direction="LEFT"
					aria-label={isSelected
						? localize('NIMBLE.classFeatureSelection.deselectFeatureAriaLabel', {
								featureName: feature.name,
							})
						: localize('NIMBLE.classFeatureSelection.selectFeatureAriaLabel', {
								featureName: feature.name,
							})}
				>
					{#if isSelected}
						<i class="fa-solid fa-check"></i>
					{/if}
				</button>
			</div>
		{/if}
	</div>

	<div class="accordion-content">
		<div class="description">
			{#if state.descriptionParts.length > 0}
				{#each state.descriptionParts as part}
					{#if part.type === 'spell' && part.spell}
						<SpellReferenceCard spell={part.spell} />
					{:else if part.type === 'text'}
						{@html part.content}
					{/if}
				{/each}
			{:else}
				<p>{localize('NIMBLE.classFeatureSelection.noDescriptionAvailable')}</p>
			{/if}
		</div>
	</div>
</li>

<style lang="scss">
	.feature-item {
		margin-bottom: 0.5rem;
		&:last-child {
			margin-bottom: 0;
		}
		list-style: none;
		overflow: hidden;
		display: grid;
		grid-template-rows: 50px 0fr;
		transition: grid-template-rows 0.3s ease;

		&.expanded {
			grid-template-rows: 50px 1fr;

			.feature-row {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
			}

			.expand-arrow {
				transform: rotate(180deg);
			}

			.accordion-content {
				opacity: 1;
			}
		}
	}

	.feature-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 50px;
		padding: 0.5rem;
		position: relative;
		cursor: pointer;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: all 0.3s ease;

		&:hover {
			border-color: var(--nimble-accent-color);
		}

		&.selected {
			border-color: var(--nimble-accent-color);
			background: color-mix(
				in srgb,
				var(--nimble-accent-color) 10%,
				var(--nimble-box-background-color)
			);
		}

		.expand-arrow {
			font-size: 0.875rem;
			transition: transform 0.3s ease;
			color: var(--nimble-medium-text-color);
		}

		.feature-row__img {
			width: 36px;
			height: 36px;
			margin: 0;
			padding: 0;
			display: block;
			border-radius: 4px;
			object-fit: cover;
		}

		.feature-row__name {
			flex: 1;
			margin: 0;
			padding: 0;
			line-height: 1;
		}

		.feature-row__actions {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-left: auto;
		}
	}

	.select-button {
		width: 1.25rem;
		min-width: 1.25rem;
		max-width: 1.25rem;
		height: 1.25rem;
		min-height: 1.25rem;
		max-height: 1.25rem;
		padding: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--nimble-medium-text-color) 15%, transparent);
		border: 2px solid color-mix(in srgb, var(--nimble-medium-text-color) 60%, transparent);
		border-radius: 50%;
		box-sizing: border-box;
		color: transparent;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover:not(:disabled) {
			border-color: color-mix(in srgb, var(--nimble-medium-text-color) 80%, transparent);
			background: color-mix(in srgb, var(--nimble-medium-text-color) 35%, transparent);
		}

		&.selected {
			background: var(--nimble-accent-color);
			border-color: var(--nimble-accent-color);
			color: #fff;

			&:hover:not(:disabled) {
				filter: brightness(1.15);
			}
		}

		&:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		i {
			font-size: 0.625rem;
		}
	}

	.accordion-content {
		background: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-top: none;
		border-radius: 0 0 4px 4px;
		padding: 0 0.75rem;
		overflow: hidden;
		opacity: 0;
		transition: opacity 0.3s ease;

		.description {
			margin-bottom: 0.5rem;
			max-height: 300px;
			overflow-y: auto;
			line-height: 1.5;

			:global(h3) {
				margin-top: 0.5rem;
				margin-bottom: 0.25rem;
				font-size: 0.95rem;
				font-weight: 600;
			}

			:global(p) {
				margin-bottom: 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}
</style>
