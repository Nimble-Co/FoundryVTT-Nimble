<script lang="ts">
	import type { SpellSelectionProps } from '#types/components/SpellGrantDisplay.d.ts';
	import type { SpellIndexEntry } from '#utils/getSpells.js';
	import localize from '#utils/localize.js';
	import SpellCard from './SpellCard.svelte';

	let { group, selected, onSelect }: SpellSelectionProps = $props();

	// Track whether to show all spells or just selected ones
	let showAllSpells = $state(false);

	function toggleSpell(spellUuid: string) {
		const currentSelection = [...selected];

		if (currentSelection.includes(spellUuid)) {
			// Remove spell - show all options again
			const filtered = currentSelection.filter((s) => s !== spellUuid);
			onSelect(filtered);
			showAllSpells = true;
		} else if (currentSelection.length < group.count) {
			// Add spell (only if we haven't reached the limit)
			onSelect([...currentSelection, spellUuid]);
			// If selection is now complete, collapse to show only selected
			if (currentSelection.length + 1 >= group.count) {
				showAllSpells = false;
			}
		}
	}

	function isSelected(spellUuid: string): boolean {
		return selected.includes(spellUuid);
	}

	function isDisabled(spellUuid: string): boolean {
		return !isSelected(spellUuid) && selected.length >= group.count;
	}

	/**
	 * Sorts spells by school (alphabetically) then by name (alphabetically)
	 */
	function sortSpellsBySchoolThenName(spells: SpellIndexEntry[]): SpellIndexEntry[] {
		return [...spells].sort((a, b) => {
			// First sort by school
			const schoolCompare = a.school.localeCompare(b.school);
			if (schoolCompare !== 0) return schoolCompare;
			// Then sort by name
			return a.name.localeCompare(b.name);
		});
	}

	const sortedSpells = $derived(sortSpellsBySchoolThenName(group.availableSpells));

	// Check if selection is complete
	const isSelectionComplete = $derived(selected.length >= group.count);

	// Get the selected spell(s) for display
	const selectedSpells = $derived(sortedSpells.filter((spell) => selected.includes(spell.uuid)));

	// Get the selected spell names for the label
	const selectedSpellNames = $derived(selectedSpells.map((s) => s.name).join(', '));

	// Determine which spells to display
	const displayedSpells = $derived(
		isSelectionComplete && !showAllSpells ? selectedSpells : sortedSpells,
	);
</script>

<div class="spell-selection">
	<div class="spell-selection__header">
		<h4 class="spell-selection__label nimble-heading" data-heading-variant="subsection">
			{#if isSelectionComplete && !showAllSpells}
				{localize('NIMBLE.spellGrants.spellsSelected', { spells: selectedSpellNames })}
			{:else}
				{group.label}
			{/if}
		</h4>

		{#if isSelectionComplete}
			<button
				type="button"
				class="spell-selection__toggle-button"
				onclick={() => (showAllSpells = !showAllSpells)}
			>
				{showAllSpells
					? localize('NIMBLE.spellGrants.hideOptions')
					: localize('NIMBLE.spellGrants.changeSelection')}
			</button>
		{/if}
	</div>

	{#if !isSelectionComplete}
		<p class="spell-selection__hint">
			{localize('NIMBLE.spellGrants.chooseSpells', { count: String(group.count) })}
		</p>
	{/if}

	{#if isSelectionComplete && !showAllSpells}
		<!-- Collapsed view: show selected spells in compact card style -->
		<ul class="spell-selection__selected-list">
			{#each selectedSpells as spell (spell.uuid)}
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
		<!-- Expanded view: show all spells with selection capability -->
		<ul class="spell-selection__spell-list">
			{#each displayedSpells as spell (spell.uuid)}
				<SpellCard
					{spell}
					isSelected={isSelected(spell.uuid)}
					isDisabled={isDisabled(spell.uuid)}
					onSelect={() => toggleSpell(spell.uuid)}
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
			margin-bottom: 0.25rem;
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
			margin: 0 0 0.5rem 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
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
			margin: 0.5rem 0 0 0;
			padding: 0;
			list-style: none;
		}
	}
</style>
