<script lang="ts">
	import type { SpellCardProps } from '#types/components/SpellGrantDisplay.d.ts';
	import localize from '#utils/localize.js';
	import { createSpellCardState } from './SpellCard.svelte.ts';

	let { spell, isSelected = false, isDisabled = false, onSelect }: SpellCardProps = $props();

	const state = createSpellCardState(() => spell);

	const tierLabel = $derived(
		spell.tier === 0
			? localize('NIMBLE.ui.heroicActions.cantrip')
			: localize('NIMBLE.ui.heroicActions.spellTier', { tier: String(spell.tier) }),
	);

	const schoolLabel = $derived(localize(CONFIG.NIMBLE.spellSchools[spell.school] ?? spell.school));

	// Whether this card is in selectable mode
	const isSelectable = $derived(!!onSelect);

	function handleRowClick() {
		// Clicking the row always toggles expansion
		state.toggleExpanded();
	}

	function handleSelectClick(e: MouseEvent) {
		e.stopPropagation(); // Prevent row click from firing
		if (!isDisabled) {
			onSelect?.();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleRowClick();
		}
	}
</script>

<li class="spell-item" class:disabled={isDisabled}>
	<div
		class="spell-row"
		class:expanded={state.isExpanded}
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
				<button
					type="button"
					class="select-button"
					class:selected={isSelected}
					onclick={handleSelectClick}
					disabled={isDisabled}
					data-tooltip={isSelected ? 'Deselect spell' : 'Select spell'}
					data-tooltip-direction="LEFT"
					aria-label={isSelected ? `Deselect ${spell.name}` : `Select ${spell.name}`}
				>
					{#if isSelected}
						<i class="fa-solid fa-check"></i>
					{/if}
				</button>
			{/if}
		</div>
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
