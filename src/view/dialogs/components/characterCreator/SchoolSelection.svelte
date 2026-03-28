<script lang="ts">
	import type { SchoolSelectionProps } from '#types/components/SpellGrantDisplay.d.ts';
	import { getSpellsFromIndex, type SpellIndexEntry } from '#utils/getSpells.js';
	import localize from '#utils/localize.js';
	import SpellCard from './SpellCard.svelte';

	let {
		group,
		spellIndex,
		selected,
		onSelect,
		isConfirmed = false,
		onConfirm,
	}: SchoolSelectionProps = $props();

	function selectSchool(school: string) {
		const currentSelection = [...selected];

		if (currentSelection.includes(school)) {
			// Deselect school
			const filtered = currentSelection.filter((s) => s !== school);
			onSelect(filtered);
		} else {
			// Select school (replace current selection if at limit, otherwise add)
			if (currentSelection.length >= group.count) {
				// Replace the current selection
				onSelect([school]);
			} else {
				// Add to selection
				onSelect([...currentSelection, school]);
			}
		}
	}

	function confirmSelection() {
		onConfirm?.();
	}

	/**
	 * Sorts spells by school (alphabetically) then by name (alphabetically)
	 */
	function sortSpellsBySchoolThenName(spells: SpellIndexEntry[]): SpellIndexEntry[] {
		return [...spells].sort((a, b) => {
			const schoolCompare = a.school.localeCompare(b.school);
			if (schoolCompare !== 0) return schoolCompare;
			return a.name.localeCompare(b.name);
		});
	}

	// Get spells from selected schools for preview
	const selectedSpells = $derived(
		selected.length > 0
			? sortSpellsBySchoolThenName(
					getSpellsFromIndex(spellIndex, selected, group.tiers, {
						utilityOnly: group.utilityOnly,
						forClass: group.forClass,
					}),
				)
			: [],
	);

	function getSchoolLabel(school: string): string {
		return localize(CONFIG.NIMBLE.spellSchools[school] ?? school);
	}

	function getSchoolIcon(school: string): string {
		return CONFIG.NIMBLE.spellSchoolIcons[school] ?? 'fa-solid fa-sparkles';
	}

	// Check if selection is complete
	const isSelectionComplete = $derived(selected.length >= group.count);

	// Get formatted list of selected school names
	const selectedSchoolNames = $derived(selected.map((s) => getSchoolLabel(s)).join(', '));
</script>

{#if !isConfirmed}
	<div class="school-selection">
		<div class="school-selection__header">
			<h4 class="school-selection__label nimble-heading" data-heading-variant="subsection">
				{group.label}
			</h4>

			{#if isSelectionComplete}
				<button type="button" class="school-selection__confirm-button" onclick={confirmSelection}>
					{localize('NIMBLE.spellGrants.confirmSelection')}
				</button>
			{/if}
		</div>

		{#if !isSelectionComplete}
			<p class="school-selection__hint">
				{localize('NIMBLE.spellGrants.chooseSchools', { count: String(group.count) })}
			</p>
		{/if}

		<!-- Always show all school options - none are disabled -->
		<div class="school-selection__options">
			{#each group.availableSchools as school (school)}
				<button
					type="button"
					class="school-selection__button"
					class:selected={selected.includes(school)}
					onclick={() => selectSchool(school)}
				>
					<i class="school-selection__icon {getSchoolIcon(school)}"></i>
					<span class="school-selection__school-name">{getSchoolLabel(school)}</span>
				</button>
			{/each}
		</div>

		{#if selectedSpells.length > 0}
			<div class="school-selection__preview">
				<h5
					class="school-selection__preview-label nimble-heading"
					data-heading-variant="subsection"
				>
					{localize('NIMBLE.spellGrants.spellsFromSelection')}
				</h5>
				<ul class="school-selection__spell-list">
					{#each selectedSpells as spell (spell.uuid)}
						<SpellCard {spell} />
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.school-selection {
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

		&__confirm-button {
			padding: 0.25rem 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			background: var(--nimble-accent-color);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-light-text-color);
			transition: var(--nimble-standard-transition);

			&:hover {
				filter: brightness(1.1);
			}
		}

		&__hint {
			margin: 0 0 0.5rem 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__options {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		&__button {
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

			&.selected {
				background: color-mix(
					in srgb,
					var(--nimble-accent-color) 20%,
					var(--nimble-basic-button-background-color)
				);
				border-color: var(--nimble-accent-color);
			}
		}

		&__icon {
			font-size: 0.875rem;
		}

		&__school-name {
			font-weight: 500;
		}

		&__preview {
			margin-top: 0.75rem;
			padding-top: 0.75rem;
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__preview-label {
			margin: 0 0 0.5rem 0;
			font-size: var(--nimble-sm-text);
		}

		&__spell-list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}
	}
</style>
