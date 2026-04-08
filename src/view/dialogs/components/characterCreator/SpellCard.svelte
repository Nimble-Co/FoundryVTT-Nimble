<script lang="ts">
	import type { SpellCardProps } from '#types/components/SpellGrantDisplay.d.ts';

	import SelectionIndicator from '#view/components/SelectionIndicator.svelte';
	import localize from '#utils/localize.js';
	import { createSpellCardState } from './SpellCard.svelte.ts';

	let { spell, isSelected = false, isDisabled = false, onSelect }: SpellCardProps = $props();

	const state = createSpellCardState(
		() => spell,
		() => onSelect,
		() => isDisabled,
	);

	const { handleRowClick, handleSelectClick, handleKeydown } = state;
	const isExpanded = $derived(state.isExpanded);
	const isSelectable = $derived(state.isSelectable);
	const tierLabel = $derived(state.tierLabel);
	const schoolLabel = $derived(state.schoolLabel);
	const isLoading = $derived(state.isLoading);
	const enrichedDescription = $derived(state.enrichedDescription);
</script>

<li class="spell-item" class:disabled={isDisabled}>
	<div
		class="spell-row"
		class:expanded={isExpanded}
		class:selected={isSelected}
		class:selectable={isSelectable}
		onclick={handleRowClick}
		role="button"
		tabindex="0"
		onkeydown={handleKeydown}
	>
		<i class="fa-solid fa-chevron-down expand-arrow"></i>

		<img class="spell-row__img" src={spell.img || 'icons/svg/item-bag.svg'} alt={spell.name} />

		<div class="spell-row__content">
			<h4 class="spell-row__name nimble-heading" data-heading-variant="item">
				{spell.name}
			</h4>
			<span class="spell-row__meta">
				{tierLabel}, {schoolLabel}
			</span>
		</div>

		<div class="spell-row__actions">
			{#if isSelectable}
				<SelectionIndicator
					selected={isSelected}
					onclick={handleSelectClick}
					disabled={isDisabled}
					tooltip={isSelected
						? localize('NIMBLE.spellGrants.deselectSpell')
						: localize('NIMBLE.spellGrants.selectSpell')}
					ariaLabel={isSelected
						? localize('NIMBLE.spellGrants.deselectSpellAriaLabel', { spellName: spell.name })
						: localize('NIMBLE.spellGrants.selectSpellAriaLabel', { spellName: spell.name })}
				/>
			{/if}
		</div>
	</div>

	{#if isExpanded}
		<div class="accordion-content">
			<div class="description">
				{#if isLoading}
					<p class="loading">{localize('NIMBLE.ui.loading')}</p>
				{:else if enrichedDescription}
					{@html enrichedDescription}
				{:else}
					<p>{localize('NIMBLE.classFeatureSelection.noDescriptionAvailable')}</p>
				{/if}
			</div>
		</div>
	{/if}
</li>

<style lang="scss">
	.spell-item {
		margin-bottom: 0.5rem;
		list-style: none;

		&.disabled {
			opacity: 0.5;
			pointer-events: none;
		}
	}

	.spell-row {
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

		&.expanded {
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;

			.expand-arrow {
				transform: rotate(180deg);
			}
		}
	}

	.expand-arrow {
		font-size: 0.875rem;
		transition: transform 0.3s ease;
		color: var(--nimble-medium-text-color);
	}

	.spell-row__img {
		width: 36px;
		height: 36px;
		margin: 0;
		padding: 0;
		display: block;
		border-radius: 4px;
		object-fit: cover;
	}

	.spell-row__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.spell-row__name {
		margin: 0;
		padding: 0;
		line-height: 1;
	}

	.spell-row__meta {
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
	}

	.spell-row__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.accordion-content {
		background: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-top: none;
		border-radius: 0 0 4px 4px;
		padding: 0.75rem;
		animation: slideDown 0.3s ease;

		.description {
			max-height: 300px;
			overflow-y: auto;
			line-height: 1.5;

			.loading {
				color: var(--nimble-medium-text-color);
				font-style: italic;
			}

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

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
		}
		to {
			opacity: 1;
			max-height: 400px;
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}
	}
</style>
