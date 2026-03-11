<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createSpellPanelState } from './CastSpellActionPanel.svelte.js';

	import SearchBar from './SearchBar.svelte';

	let actor = getContext('actor');
	let sheet = getContext('application');

	let { onActivateItem = async () => {}, showEmbeddedDocumentImages = true } = $props();

	const state = createSpellPanelState(actor, onActivateItem);
</script>

<section class="spell-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.selectSpell')}
		</h3>
	</header>

	<div class="spell-panel__search">
		<SearchBar bind:searchTerm={state.searchTerm} />
	</div>

	<div class="spell-panel__content">
		{#if state.spells.length > 0}
			<ul class="spell-panel__list">
				{#each state.sortItems(state.spells) as spell (spell._id)}
					{@const meta = state.getSpellMetadata(spell)}
					{@const manaCost = state.getSpellManaCost(spell)}
					{@const effect = state.getSpellEffect(spell)}
					{@const spellRange = state.getSpellRange(spell)}
					{@const requiresConcentration =
						spell.reactive.system.properties.selected.includes('concentration')}
					{@const spellTier = spell.reactive.system.tier}
					{@const targetType = state.getSpellTargetType(spell)}
					{@const isExpanded = state.expandedDescriptions.has(spell._id)}
					{@const spellEffects = state.getSpellEffects(spell)}

					<li class="spell-card" class:spell-card--expanded={isExpanded} data-item-id={spell._id}>
						<div
							class="spell-card__row"
							role="button"
							tabindex="0"
							draggable="true"
							ondragstart={(event) => sheet._onDragStart(event)}
							onclick={() => state.handleSpellClick(spell._id)}
							onkeydown={(e) => state.handleKeydown(e, () => state.handleSpellClick(spell._id))}
						>
							{#if showEmbeddedDocumentImages}
								<img class="spell-card__img" src={spell.reactive.img} alt={spell.reactive.name} />
							{/if}

							<div class="spell-card__content">
								<div class="spell-card__header">
									<span class="spell-card__name">{spell.reactive.name},</span>
									<span class="spell-card__tier"
										>{spellTier === 0
											? localize('NIMBLE.ui.heroicActions.cantrip')
											: localize('NIMBLE.ui.heroicActions.spellTier', {
													tier: spellTier,
												})}{meta || requiresConcentration ? ',' : ''}</span
									>
									{#if meta}
										<span class="spell-card__action-cost"
											>{@html meta}{requiresConcentration ? ',' : ''}</span
										>
									{/if}
									{#if requiresConcentration}
										<span class="spell-card__tag">C</span>
									{/if}
								</div>

								<div class="spell-card__meta">
									{#if targetType}
										<span class="spell-card__target-type"
											>{targetType}{spellRange || manaCost > 0 ? ',' : ''}</span
										>
									{/if}
									{#if spellRange}
										<span class="spell-card__range">{spellRange}{manaCost > 0 ? ',' : ''}</span>
									{/if}
									{#if manaCost > 0}
										<span class="spell-card__mana">
											<i class="fa-solid fa-sparkles"></i>
											{localize('NIMBLE.ui.heroicActions.mana', { cost: manaCost })}
										</span>
									{/if}
								</div>
							</div>

							{#if effect}
								<span
									class="spell-card__effect"
									class:spell-card__effect--healing={effect.isHealing}
								>
									<i class="fa-solid {effect.isHealing ? 'fa-heart' : 'fa-burst'}"></i>
									{effect.formula}
								</span>
							{/if}

							{#if spellEffects}
								<button
									class="spell-card__expand"
									type="button"
									onclick={(e) => state.toggleDescription(spell._id, e)}
									aria-label={localize(
										isExpanded
											? 'NIMBLE.ui.heroicActions.collapse'
											: 'NIMBLE.ui.heroicActions.expand',
									)}
								>
									<i class="fa-solid fa-caret-{isExpanded ? 'up' : 'down'}"></i>
								</button>
							{/if}
						</div>

						{#if isExpanded && spellEffects}
							<div class="spell-card__description">
								{#if spellEffects.baseEffect}
									<div class="spell-card__effect-section">
										<strong>{localize('NIMBLE.ui.heroicActions.baseEffect')}</strong>
										{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(spellEffects.baseEffect) then enrichedEffect}
											{@html enrichedEffect}
										{:catch}
											{@html spellEffects.baseEffect}
										{/await}
									</div>
								{/if}
								{#if spellEffects.higherLevelEffect}
									<div class="spell-card__effect-section">
										<strong>{localize('NIMBLE.ui.heroicActions.higherLevelEffect')}</strong>
										{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(spellEffects.higherLevelEffect) then enrichedEffect}
											{@html enrichedEffect}
										{:catch}
											{@html spellEffects.higherLevelEffect}
										{/await}
									</div>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="spell-panel__empty">
				{localize('NIMBLE.ui.heroicActions.noSpellsFound')}
			</p>
		{/if}
	</div>
</section>

<style lang="scss">
	.spell-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__search {
			display: flex;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			max-height: 300px;
			overflow-y: auto;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__empty {
			margin: 0;
			padding: 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}
	}

	.spell-card {
		display: flex;
		flex-direction: column;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);

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

		&__target-type {
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

		&__tier {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__meta {
			display: flex;
			align-items: center;
			gap: 0.75rem;
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

		&__action-cost {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

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

		&__expand {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			background: transparent;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			flex-shrink: 0;
			color: var(--nimble-medium-text-color);
			transition: all 0.15s ease;

			&:hover {
				background: var(--nimble-basic-button-background-color);
				color: var(--nimble-dark-text-color);
			}

			i {
				font-size: 0.875rem;
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
