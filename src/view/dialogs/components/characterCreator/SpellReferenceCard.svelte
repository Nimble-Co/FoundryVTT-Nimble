<script lang="ts">
	import type { SpellReferenceCardProps } from '#types/components/SpellReferenceCard.d.ts';
	import localize from '../../../../utils/localize.js';
	import { createSpellCardState } from './SpellReferenceCard.svelte.ts';

	let { spell }: SpellReferenceCardProps = $props();

	const state = createSpellCardState(() => spell);

	function handleRowClick() {
		state.toggleExpanded();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			state.toggleExpanded();
		}
	}

	function handleViewDetails(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		state.viewDetails();
	}
</script>

<div class="spell-reference-wrapper">
	<div
		class="spell-reference-card"
		class:expanded={state.isExpanded}
		role="button"
		tabindex="0"
		onclick={handleRowClick}
		onkeydown={handleKeydown}
	>
		<i class="fa-solid fa-chevron-down expand-arrow"></i>

		<img
			class="spell-reference-card__img"
			src={spell.img || 'icons/svg/item-bag.svg'}
			alt={spell.name}
		/>

		<div class="spell-reference-card__content">
			<div class="spell-reference-card__header">
				<span class="spell-reference-card__name">{spell.name},</span>
				<span class="spell-reference-card__tier">
					{state.displayData.tier === 0
						? localize('NIMBLE.ui.heroicActions.cantrip')
						: localize('NIMBLE.ui.heroicActions.spellTier', {
								tier: String(state.displayData.tier),
							})}{state.displayData.meta || state.displayData.requiresConcentration ? ',' : ''}
				</span>
				{#if state.displayData.meta}
					<span class="spell-reference-card__action-cost"
						>{state.displayData.meta}{state.displayData.requiresConcentration ? ',' : ''}</span
					>
				{/if}
				{#if state.displayData.requiresConcentration}
					<span class="spell-reference-card__tag">C</span>
				{/if}
			</div>

			<div class="spell-reference-card__meta">
				{#if state.displayData.targetType}
					<span class="spell-reference-card__target-type"
						>{state.displayData.targetType}{state.displayData.spellRange ? ',' : ''}</span
					>
				{/if}
				{#if state.displayData.spellRange}
					<span class="spell-reference-card__range">{state.displayData.spellRange}</span>
				{/if}
			</div>
		</div>

		{#if state.displayData.effect}
			<span
				class="spell-reference-card__effect"
				class:spell-reference-card__effect--healing={state.displayData.effect.isHealing}
			>
				<i class="fa-solid {state.displayData.effect.isHealing ? 'fa-heart' : 'fa-burst'}"></i>
				{state.displayData.effect.formula}
			</span>
		{/if}

		<button
			type="button"
			class="view-details-button"
			onclick={handleViewDetails}
			title="View Details"
			aria-label="View {spell.name} details"
		>
			<i class="fa-solid fa-book-open"></i>
		</button>
	</div>

	{#if state.isExpanded}
		<div class="accordion-content">
			<div class="description">
				{#if state.isLoading}
					<p class="loading">Loading...</p>
				{:else if state.enrichedDescription}
					{@html state.enrichedDescription}
				{:else}
					<p>{localize('NIMBLE.classFeatureSelection.noDescriptionAvailable')}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.spell-reference-wrapper {
		margin: 0.5rem 0;
	}

	.spell-reference-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		position: relative;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-accent-color);
		}

		&.expanded {
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;

			.expand-arrow {
				transform: rotate(180deg);
			}
		}

		&__img {
			width: 2rem;
			height: 2rem;
			object-fit: cover;
			border-radius: 3px;
			flex-shrink: 0;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__header {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 0.375rem;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__tier {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__action-cost {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__tag {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			padding: 0 0.25rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 2px;
		}

		&__meta {
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}

		&__target-type,
		&__range {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__effect {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-basic-button-background-color);
			border-radius: 3px;
			flex-shrink: 0;
			margin-right: 2.5rem;

			i {
				font-size: 0.875rem;
				color: hsl(0, 60%, 50%);
			}

			&--healing i {
				color: hsl(139, 50%, 40%);
			}
		}
	}

	.expand-arrow {
		font-size: 0.75rem;
		transition: transform 0.3s ease;
		color: var(--nimble-medium-text-color);
		flex-shrink: 0;
	}

	.view-details-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--nimble-accent-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		color: var(--nimble-light-text-color);
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 1;

		&:hover {
			filter: brightness(1.2);
			transform: scale(1.05);
		}

		i {
			font-size: 0.75rem;
		}
	}

	.accordion-content {
		background: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-top: none;
		border-radius: 0 0 4px 4px;
		padding: 0.75rem;
		animation: slideDown 0.3s ease;

		.description {
			max-height: 200px;
			overflow-y: auto;
			line-height: 1.5;
			font-size: var(--nimble-sm-text);

			.loading {
				color: var(--nimble-medium-text-color);
				font-style: italic;
			}

			:global(h3) {
				margin-top: 0.5rem;
				margin-bottom: 0.25rem;
				font-size: 0.9rem;
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

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
		}
		to {
			opacity: 1;
			max-height: 300px;
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}
	}
</style>
