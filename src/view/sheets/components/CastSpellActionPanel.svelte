<script>
	import { getContext } from 'svelte';
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import sortItems from '../../../utils/sortItems.js';
	import localize from '../../../utils/localize.js';
	import { flattenActivationEffects } from '../../../utils/activationEffects.js';

	import SearchBar from './SearchBar.svelte';

	const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;

	let actor = getContext('actor');
	let sheet = getContext('application');

	let { onActivateItem = async () => {}, showEmbeddedDocumentImages = true } = $props();

	let searchTerm = $state('');
	let expandedDescriptions = $state(new Set());

	// ============================================================================
	// Formula Evaluation
	// ============================================================================

	function evaluateFormula(formula) {
		if (!formula) return '';

		try {
			const rollData = actor.getRollData();
			const substituted = Roll.replaceFormulaData(formula, rollData, { missing: '0' });

			const parts = substituted.split(/([+-])/);
			const simplified = [];

			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				if (trimmed === '+' || trimmed === '-') {
					simplified.push(trimmed);
				} else if (/^\d*d\d+/i.test(trimmed)) {
					simplified.push(trimmed);
				} else {
					try {
						const evaluated = Roll.safeEval(trimmed);
						if (typeof evaluated === 'number' && !isNaN(evaluated)) {
							simplified.push(String(Math.floor(evaluated)));
						} else {
							simplified.push(trimmed);
						}
					} catch {
						simplified.push(trimmed);
					}
				}
			}

			let result = simplified.join(' ').replace(/\s+/g, ' ').trim();
			result = result.replace(/[+-]\s*0(?!\d)/g, '').trim();
			result = result
				.replace(/^\s*[+-]\s*/, '')
				.replace(/[+-]\s*[+-]/g, '+')
				.trim();

			return result || formula;
		} catch {
			return formula;
		}
	}

	// ============================================================================
	// Spell Data
	// ============================================================================

	let spells = $derived(filterItems(actor.reactive, ['spell'], searchTerm));

	function getSpellEffect(spell) {
		const effects =
			spell.reactive?.system?.activation?.effects ?? spell.system?.activation?.effects;
		const flattened = flattenActivationEffects(effects);

		for (const node of flattened) {
			const effectType = node.type;
			if (effectType !== 'damage' && effectType !== 'healing') continue;

			const formula = node.formula || node.roll;
			if (typeof formula === 'string' && formula.trim().length > 0) {
				return {
					formula: evaluateFormula(formula.trim()),
					isHealing: effectType === 'healing' || node.damageType === 'healing',
				};
			}
		}

		return null;
	}

	function getSpellManaCost(spell) {
		return spell.reactive.system.manaCost ?? 0;
	}

	function getSpellMetadata(spell) {
		const { type: activationType, quantity: activationCost } =
			spell.reactive.system.activation.cost;

		if (!activationType || activationType === 'none') return null;

		if (['action', 'minute', 'hour'].includes(activationType)) {
			const label =
				activationCost > 1
					? activationCostTypesPlural[activationType]
					: activationCostTypes[activationType];
			return `${activationCost || 1} ${label}`;
		}

		if (activationType === 'reaction' || activationType === 'special') {
			return activationCostTypes[activationType];
		}

		return null;
	}

	function getSpellRange(spell) {
		const props = spell.reactive?.system?.properties ?? spell.system?.properties ?? {};
		const selected = props.selected ?? [];

		if (selected.includes('range') && props.range?.max) {
			return localize('NIMBLE.ui.heroicActions.rangeDistance', { distance: props.range.max });
		}
		if (selected.includes('reach') && props.reach?.max) {
			return localize('NIMBLE.ui.heroicActions.reachDistance', { distance: props.reach.max });
		}
		return null;
	}

	function getSpellTargetType(spell) {
		const activation = spell.reactive?.system?.activation ?? spell.system?.activation;
		if (!activation) return null;

		if (activation.acquireTargetsFromTemplate) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.aoe');
		}

		const targetCount = activation.targets?.count ?? 1;

		if (targetCount === 0) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.self');
		}
		if (targetCount === 1) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.singleTarget');
		}
		if (targetCount === 2) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.twoTargets');
		}
		return localize('NIMBLE.ui.heroicActions.targetTypes.multiTarget', { count: targetCount });
	}

	function hasContent(text) {
		if (!text || typeof text !== 'string') return false;
		const stripped = text.replace(/<[^>]*>/g, '').trim();
		return stripped.length > 0;
	}

	function getSpellEffects(spell) {
		const desc = spell.reactive?.system?.description ?? spell.system?.description;
		if (!desc) return null;

		const baseEffect = desc.baseEffect;
		const higherLevelEffect = desc.higherLevelEffect;

		const hasBase = hasContent(baseEffect);
		const hasHigher = hasContent(higherLevelEffect);

		if (!hasBase && !hasHigher) return null;

		return {
			baseEffect: hasBase ? baseEffect : null,
			higherLevelEffect: hasHigher ? higherLevelEffect : null,
		};
	}

	function toggleDescription(spellId, event) {
		event.stopPropagation();
		const newSet = new Set(expandedDescriptions);
		if (newSet.has(spellId)) {
			newSet.delete(spellId);
		} else {
			newSet.add(spellId);
		}
		expandedDescriptions = newSet;
	}

	async function handleSpellClick(spellId) {
		const spell = actor.items.get(spellId);
		const result = await actor.activateItem(spellId);

		if (result) {
			const activationCost = spell?.system?.activation?.cost;
			const costType = activationCost?.type;
			const costQuantity = activationCost?.quantity ?? 1;

			if (costType === 'action') {
				await onActivateItem(costQuantity);
			}
		}

		return result;
	}
</script>

<section class="spell-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.selectSpell')}
		</h3>
	</header>

	<div class="spell-panel__search">
		<SearchBar bind:searchTerm />
	</div>

	<div class="spell-panel__content">
		{#if spells.length > 0}
			<ul class="spell-panel__list">
				{#each sortItems(spells) as spell (spell._id)}
					{@const meta = getSpellMetadata(spell)}
					{@const manaCost = getSpellManaCost(spell)}
					{@const effect = getSpellEffect(spell)}
					{@const spellRange = getSpellRange(spell)}
					{@const requiresConcentration =
						spell.reactive.system.properties.selected.includes('concentration')}
					{@const spellTier = spell.reactive.system.tier}
					{@const targetType = getSpellTargetType(spell)}
					{@const isExpanded = expandedDescriptions.has(spell._id)}
					{@const spellEffects = getSpellEffects(spell)}

					<li class="spell-card" class:spell-card--expanded={isExpanded} data-item-id={spell._id}>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="spell-card__row"
							role="button"
							tabindex="0"
							draggable="true"
							ondragstart={(event) => sheet._onDragStart(event)}
							onclick={() => handleSpellClick(spell._id)}
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
									onclick={(e) => toggleDescription(spell._id, e)}
									aria-label={isExpanded ? 'Collapse' : 'Expand'}
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
										{/await}
									</div>
								{/if}
								{#if spellEffects.higherLevelEffect}
									<div class="spell-card__effect-section">
										<strong>{localize('NIMBLE.ui.heroicActions.higherLevelEffect')}</strong>
										{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(spellEffects.higherLevelEffect) then enrichedEffect}
											{@html enrichedEffect}
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
