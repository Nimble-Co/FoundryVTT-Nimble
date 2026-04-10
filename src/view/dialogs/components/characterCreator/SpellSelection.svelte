<script lang="ts">
	import type { SpellSelectionProps } from '#types/components/SpellGrantDisplay.d.ts';
	import localize from '#utils/localize.js';
	import SpellCard from './SpellCard.svelte';
	import { createSpellSelectionState } from './SpellSelection.svelte.ts';

	let { group, selected, onSelect }: SpellSelectionProps = $props();

	const state = createSpellSelectionState({
		group: () => group,
		selected: () => selected,
		onSelect: (spellUuids) => onSelect(spellUuids),
	});

	function getSchoolLabel(school: string): string {
		return localize(CONFIG.NIMBLE.spellSchools[school] ?? school);
	}

	function getSchoolIcon(school: string): string {
		return CONFIG.NIMBLE.spellSchoolIcons?.[school] ?? 'fa-solid fa-hat-wizard';
	}
</script>

<div class="spell-selection">
	<div class="spell-selection__header">
		<h4 class="spell-selection__label nimble-heading" data-heading-variant="subsection">
			{#if state.isSelectionComplete && !state.showAllSpells}
				{localize('NIMBLE.spellGrants.spellsSelected', { spells: state.selectedSpellNames })}
			{:else}
				{group.label}
			{/if}
		</h4>

		{#if state.isSelectionComplete}
			<button
				type="button"
				class="spell-selection__toggle-button"
				onclick={() => state.setShowAllSpells(!state.showAllSpells)}
			>
				{state.showAllSpells
					? localize('NIMBLE.spellGrants.hideOptions')
					: localize('NIMBLE.spellGrants.changeSelection')}
			</button>
		{/if}
	</div>

	{#if !state.isSelectionComplete}
		<p class="spell-selection__hint">
			{localize('NIMBLE.spellGrants.chooseSpells', { count: String(group.count) })}
		</p>
	{/if}

	{#if state.isSelectionComplete && !state.showAllSpells}
		<!-- Collapsed view: show selected spells in compact card style -->
		<ul class="spell-selection__selected-list">
			{#each state.selectedSpells as spell (spell.uuid)}
				<li>
					<button class="nimble-card" data-card-option="non-clickable">
						<img
							class="nimble-card__img"
							src={spell.img || 'icons/svg/item-bag.svg'}
							alt={spell.name}
						/>
						<h3 class="nimble-card__title nimble-heading" data-heading-variant="item">
							{spell.name}
						</h3>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<!-- School filter buttons -->
		<div class="spell-selection__school-filters">
			{#each state.availableSchools as school (school)}
				<button
					type="button"
					class="spell-selection__school-button"
					class:active={state.activeSchoolFilter === school}
					onclick={() =>
						state.setActiveSchoolFilter(state.activeSchoolFilter === school ? null : school)}
				>
					<i class="spell-selection__school-icon {getSchoolIcon(school)}"></i>
					<span class="spell-selection__school-name">{getSchoolLabel(school)}</span>
				</button>
			{/each}
		</div>

		<!-- Filtered spells list -->
		<ul class="spell-selection__spell-list">
			{#each state.displayedSpells as spell (spell.uuid)}
				<SpellCard
					{spell}
					isSelected={state.isSelected(spell.uuid)}
					isDisabled={state.isDisabled(spell.uuid)}
					onSelect={() => state.toggleSpell(spell.uuid)}
				/>
			{/each}
		</ul>
	{/if}
</div>

<style lang="scss">
	.spell-selection {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}

		&__label {
			margin: 0;
		}

		&__toggle-button {
			padding: 0.25rem 0.5rem;
			font-size: var(--nimble-xs-text);
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-medium-text-color);
			transition: var(--nimble-standard-transition);

			&:hover {
				border-color: var(--nimble-accent-color);
				color: var(--nimble-light-text-color);
			}
		}

		&__hint {
			margin: 0 0 0.75rem 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__school-filters {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin-bottom: 0.75rem;
		}

		&__school-button {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.75rem;
			background: var(--nimble-basic-button-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);
			font-size: var(--nimble-sm-text);

			&:hover {
				border-color: var(--nimble-accent-color);
			}

			&.active {
				background: color-mix(
					in srgb,
					var(--nimble-accent-color) 20%,
					var(--nimble-basic-button-background-color)
				);
				border-color: var(--nimble-accent-color);
			}
		}

		&__school-icon {
			font-size: 0.875rem;
		}

		&__school-name {
			font-weight: 500;
		}

		&__spell-list {
			display: flex;
			flex-direction: column;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__selected-list {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin: 0.375rem 0 0 0;
			padding: 0;
			list-style: none;
		}
	}
</style>
