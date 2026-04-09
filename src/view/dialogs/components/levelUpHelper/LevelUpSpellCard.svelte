<script lang="ts">
	import type { SpellIndexEntry } from '#utils/getSpells.js';
	import { flattenActivationEffects } from '#utils/activationEffects.js';
	import localize from '#utils/localize.js';

	interface LevelUpSpellCardProps {
		spell: SpellIndexEntry;
	}

	interface SpellSystemData {
		manaCost?: number;
		tier?: number;
		activation?: {
			effects?: unknown[];
			cost?: { type: string; quantity: number };
			acquireTargetsFromTemplate?: boolean;
			targets?: { count: number };
		};
		properties?: {
			selected?: string[];
			reach?: { max?: number };
			range?: { max?: number };
		};
		description?: {
			baseEffect?: string;
			higherLevelEffect?: string;
		};
	}

	interface SpellDisplayData {
		meta: string | null;
		requiresConcentration: boolean;
		targetType: string | null;
		spellRange: string | null;
		manaCost: number;
		effect: { formula: string; isHealing: boolean } | null;
		baseEffect: string | null;
		higherLevelEffect: string | null;
	}

	let { spell }: LevelUpSpellCardProps = $props();

	let displayData = $state<SpellDisplayData | null>(null);
	let isExpanded = $state(false);

	// Load full spell data on mount to populate metadata
	$effect(() => {
		fromUuid(spell.uuid as `Item.${string}`).then((item) => {
			if (!item) return;
			const system = (item as Item).system as unknown as SpellSystemData;
			displayData = extractDisplayData(system);
		});
	});

	function extractDisplayData(system: SpellSystemData): SpellDisplayData {
		const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;

		// Action cost
		let meta: string | null = null;
		const activation = system.activation;
		if (activation?.cost) {
			const { type: activationType, quantity: activationCost } = activation.cost;
			if (activationType && activationType !== 'none') {
				if (['action', 'minute', 'hour'].includes(activationType)) {
					const label =
						activationCost > 1
							? activationCostTypesPlural[activationType]
							: activationCostTypes[activationType];
					meta = `${activationCost || 1} ${label}`;
				} else if (activationType === 'reaction' || activationType === 'special') {
					meta = activationCostTypes[activationType];
				}
			}
		}

		// Concentration
		const requiresConcentration = system.properties?.selected?.includes('concentration') ?? false;

		// Target type
		let targetType: string | null = null;
		if (activation) {
			if (activation.acquireTargetsFromTemplate) {
				targetType = localize('NIMBLE.ui.heroicActions.targetTypes.aoe');
			} else {
				const targetCount = activation.targets?.count ?? 1;
				if (targetCount === 0) targetType = localize('NIMBLE.ui.heroicActions.targetTypes.self');
				else if (targetCount === 1)
					targetType = localize('NIMBLE.ui.heroicActions.targetTypes.singleTarget');
				else if (targetCount === 2)
					targetType = localize('NIMBLE.ui.heroicActions.targetTypes.twoTargets');
				else
					targetType = localize('NIMBLE.ui.heroicActions.targetTypes.multiTarget', {
						count: String(targetCount),
					});
			}
		}

		// Range
		let spellRange: string | null = null;
		const props = system.properties ?? {};
		const selected = props.selected ?? [];
		if (selected.includes('range') && props.range?.max) {
			spellRange = localize('NIMBLE.ui.heroicActions.rangeDistance', {
				distance: String(props.range.max),
			});
		} else if (selected.includes('reach') && props.reach?.max) {
			spellRange = localize('NIMBLE.ui.heroicActions.reachDistance', {
				distance: String(props.reach.max),
			});
		}

		// Mana cost
		const manaCost = system.manaCost ?? 0;

		// Damage/healing effect
		let effect: { formula: string; isHealing: boolean } | null = null;
		const effects = activation?.effects;
		const flattened = flattenActivationEffects(effects);
		for (const node of flattened) {
			const effectType = node.type;
			if (effectType !== 'damage' && effectType !== 'healing') continue;
			const formula = node.formula || node.roll;
			if (typeof formula === 'string' && formula.trim().length > 0) {
				effect = {
					formula: formula.trim(),
					isHealing: effectType === 'healing' || node.damageType === 'healing',
				};
				break;
			}
		}

		// Description
		const desc = system.description;
		const hasContent = (text: unknown): text is string =>
			typeof text === 'string' && text.replace(/<[^>]*>/g, '').trim().length > 0;

		return {
			meta,
			requiresConcentration,
			targetType,
			spellRange,
			manaCost,
			effect,
			baseEffect: hasContent(desc?.baseEffect) ? desc!.baseEffect : null,
			higherLevelEffect: hasContent(desc?.higherLevelEffect) ? desc!.higherLevelEffect : null,
		};
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			isExpanded = !isExpanded;
		}
	}
</script>

<li class="spell-card" class:spell-card--expanded={isExpanded}>
	<div
		class="spell-card__row"
		role="button"
		tabindex="0"
		onclick={() => (isExpanded = !isExpanded)}
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

	{#if isExpanded && displayData}
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
