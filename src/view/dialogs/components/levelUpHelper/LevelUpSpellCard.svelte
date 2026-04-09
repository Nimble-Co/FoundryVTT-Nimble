<script lang="ts">
	import type { LevelUpSpellCardProps } from '#types/components/LevelUpSpellCard.d.ts';
	import localize from '#utils/localize.js';
	import { createLevelUpSpellCardState } from './LevelUpSpellCard.svelte.ts';

	let { spell }: LevelUpSpellCardProps = $props();

	const state = createLevelUpSpellCardState(() => spell);
	const { toggleExpanded, handleKeydown } = state;
	const displayData = $derived(displayData);
	const isExpanded = $derived(state.isExpanded);
</script>

<li class="spell-card" class:spell-card--expanded={isExpanded}>
	<div
		class="spell-card__row"
		role="button"
		tabindex="0"
		onclick={toggleExpanded}
		onkeydown={handleKeydown}
	>
		<i class="fa-solid fa-chevron-down spell-card__chevron"></i>

		<img class="spell-card__img" src={spell.img || 'icons/svg/item-bag.svg'} alt={spell.name} />

		<div class="spell-card__content">
			<div class="spell-card__header">
				<span class="spell-card__name">{spell.name},</span>
				<span class="spell-card__tier">
					{spell.tier === 0
						? localize('NIMBLE.ui.heroicActions.cantrip')
						: localize('NIMBLE.ui.heroicActions.spellTier', {
								tier: String(spell.tier),
							})}{displayData?.meta || displayData?.requiresConcentration ? ',' : ''}
				</span>
				{#if displayData?.meta}
					<span class="spell-card__action-cost">
						{displayData.meta}{displayData.requiresConcentration ? ',' : ''}
					</span>
				{/if}
				{#if displayData?.requiresConcentration}
					<span class="spell-card__tag">C</span>
				{/if}
			</div>

			{#if displayData}
				<div class="spell-card__meta">
					{#if displayData.targetType}
						<span class="spell-card__target-type">
							{displayData.targetType}{displayData.spellRange || displayData.manaCost > 0
								? ','
								: ''}
						</span>
					{/if}
					{#if displayData.spellRange}
						<span class="spell-card__range">
							{displayData.spellRange}{displayData.manaCost > 0 ? ',' : ''}
						</span>
					{/if}
					{#if displayData.manaCost > 0}
						<span class="spell-card__mana">
							<i class="fa-solid fa-sparkles"></i>
							{localize('NIMBLE.ui.heroicActions.mana', { cost: displayData.manaCost })}
						</span>
					{/if}
				</div>
			{/if}
		</div>

		{#if displayData?.effect}
			<span
				class="spell-card__effect"
				class:spell-card__effect--healing={displayData.effect.isHealing}
			>
				<i class="fa-solid {displayData.effect.isHealing ? 'fa-heart' : 'fa-burst'}"></i>
				{displayData.effect.formula}
			</span>
		{/if}
	</div>

	{#if state.isExpanded && displayData}
		<div class="spell-card__description">
			{#if displayData.baseEffect}
				<div class="spell-card__effect-section">
					<strong>{localize('NIMBLE.ui.heroicActions.baseEffect')}</strong>
					{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(displayData.baseEffect) then enriched}
						{@html enriched}
					{:catch}
						{@html displayData.baseEffect}
					{/await}
				</div>
			{/if}
			{#if displayData.higherLevelEffect}
				<div class="spell-card__effect-section">
					<strong>{localize('NIMBLE.ui.heroicActions.higherLevelEffect')}</strong>
					{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(displayData.higherLevelEffect) then enriched}
						{@html enriched}
					{:catch}
						{@html displayData.higherLevelEffect}
					{/await}
				</div>
			{/if}
		</div>
	{/if}
</li>

<style lang="scss">
	.spell-card {
		display: flex;
		flex-direction: column;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);
		margin-bottom: 0.5rem;
		list-style: none;

		&:last-child {
			margin-bottom: 0;
		}

		&--expanded {
			.spell-card__chevron {
				transform: rotate(180deg);
			}

			.spell-card__row {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
			}
		}

		&:hover {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			cursor: pointer;
		}

		&__chevron {
			font-size: 0.875rem;
			transition: transform 0.3s ease;
			color: var(--nimble-medium-text-color);
			flex-shrink: 0;
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
			gap: 0.75rem;
		}

		&__target-type,
		&__range {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__mana {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: hsl(270, 50%, 45%);

			i {
				font-size: 0.625rem;
			}
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

			i {
				font-size: 0.875rem;
				color: hsl(0, 60%, 50%);
			}

			&--healing i {
				color: hsl(139, 50%, 40%);
			}
		}

		&__description {
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
			border-top: 1px solid var(--nimble-card-border-color);
			line-height: 1.5;

			:global(p) {
				margin: 0 0 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}

		&__effect-section {
			&:not(:last-child) {
				margin-bottom: 0.75rem;
				padding-bottom: 0.75rem;
				border-bottom: 1px solid var(--nimble-card-border-color);
			}

			strong {
				display: block;
				margin-bottom: 0.25rem;
				font-size: var(--nimble-xs-text);
				color: var(--nimble-medium-text-color);
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			:global(p) {
				margin: 0 0 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}
</style>
