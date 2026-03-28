<script lang="ts">
	import type { SchoolSelectionProps } from '#types/components/SpellGrantDisplay.d.ts';
	import { getSpellsFromIndex, type SpellIndexEntry } from '#utils/getSpells.js';
	import localize from '#utils/localize.js';
	import SpellCard from './SpellCard.svelte';

	let { group, spellIndex, selected, onSelect }: SchoolSelectionProps = $props();

	function toggleSchool(school: string) {
		const currentSelection = [...selected];

		if (currentSelection.includes(school)) {
			// Remove school
			const filtered = currentSelection.filter((s) => s !== school);
			onSelect(filtered);
		} else if (currentSelection.length < group.count) {
			// Add school (only if we haven't reached the limit)
			onSelect([...currentSelection, school]);
		}
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

	// Get spells from selected schools for preview, sorted by school then name
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
</script>

<div class="school-selection">
	<h4 class="school-selection__label nimble-heading" data-heading-variant="subsection">
		{group.label}
	</h4>

	<p class="school-selection__hint">
		{localize('NIMBLE.spellGrants.chooseSchools', { count: String(group.count) })}
	</p>

	<div class="school-selection__options">
		{#each group.availableSchools as school (school)}
			<button
				type="button"
				class="school-selection__button"
				class:selected={selected.includes(school)}
				disabled={!selected.includes(school) && selected.length >= group.count}
				onclick={() => toggleSchool(school)}
			>
				<i class="school-selection__icon {getSchoolIcon(school)}"></i>
				<span class="school-selection__school-name">{getSchoolLabel(school)}</span>
			</button>
		{/each}
	</div>

	{#if selectedSpells.length > 0}
		<div class="school-selection__preview">
			<h5 class="school-selection__preview-label nimble-heading" data-heading-variant="subsection">
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

<style lang="scss">
	.school-selection {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__label {
			margin: 0 0 0.25rem 0;
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

			&:hover:not(:disabled) {
				border-color: var(--nimble-accent-color);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
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
