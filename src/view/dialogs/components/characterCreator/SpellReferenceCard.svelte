<script lang="ts">
	import type { SpellReferenceCardProps } from '#types/components/SpellReferenceCard.d.ts';
	import localize from '../../../../utils/localize.js';
	import { createSpellCardState } from './SpellReferenceCard.svelte.ts';

	let { spell }: SpellReferenceCardProps = $props();

	const state = createSpellCardState(() => spell);

	function openSheet(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		spell.sheet?.render(true);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			spell.sheet?.render(true);
		}
	}
</script>

<div
	class="spell-reference-card"
	role="button"
	tabindex="0"
	onclick={openSheet}
	onkeydown={handleKeydown}
>
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
</div>

<style lang="scss">
	.spell-reference-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		margin: 0.5rem 0;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
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

			i {
				font-size: 0.875rem;
				color: hsl(0, 60%, 50%);
			}

			&--healing i {
				color: hsl(139, 50%, 40%);
			}
		}
	}
</style>
