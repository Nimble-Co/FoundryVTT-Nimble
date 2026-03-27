<script lang="ts">
	import type { SpellSelectionProps } from '#types/components/SpellGrantDisplay.d.ts';
	import type { SpellIndexEntry } from '#utils/getSpells.js';
	import localize from '#utils/localize.js';
	import SpellCard from './SpellCard.svelte';

	let { group, selected, onSelect }: SpellSelectionProps = $props();

	function toggleSpell(spellUuid: string) {
		const currentSelection = [...selected];

		if (currentSelection.includes(spellUuid)) {
			// Remove spell
			const filtered = currentSelection.filter((s) => s !== spellUuid);
			onSelect(filtered);
		} else if (currentSelection.length < group.count) {
			// Add spell (only if we haven't reached the limit)
			onSelect([...currentSelection, spellUuid]);
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
</script>

<div class="spell-selection">
	<h4 class="spell-selection__label nimble-heading" data-heading-variant="subsection">
		{group.label}
	</h4>

	<p class="spell-selection__hint">
		{localize('NIMBLE.spellGrants.chooseSpells', { count: String(group.count) })}
	</p>

	<ul class="spell-selection__spell-list">
		{#each sortedSpells as spell (spell.uuid)}
			<li class="spell-selection__spell-item">
				<button
					type="button"
					class="spell-selection__spell-button"
					class:selected={isSelected(spell.uuid)}
					disabled={isDisabled(spell.uuid)}
					onclick={() => toggleSpell(spell.uuid)}
				>
					<SpellCard {spell} />
				</button>
			</li>
		{/each}
	</ul>

	{#if selected.length > 0}
		<div class="spell-selection__summary">
			<span class="spell-selection__count">
				{localize('NIMBLE.spellGrants.selectedCount', {
					selected: String(selected.length),
					total: String(group.count),
				})}
			</span>
		</div>
	{/if}
</div>

<style lang="scss">
	.spell-selection {
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

		&__spell-list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__spell-item {
			margin: 0;
			padding: 0;
		}

		&__spell-button {
			width: 100%;
			padding: 0;
			background: transparent;
			border: 2px solid transparent;
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);
			text-align: left;

			&:hover:not(:disabled) {
				border-color: var(--nimble-accent-color);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			&.selected {
				border-color: var(--nimble-accent-color);
				background: color-mix(
					in srgb,
					var(--nimble-accent-color) 10%,
					var(--nimble-basic-button-background-color)
				);
			}
		}

		&__summary {
			margin-top: 0.75rem;
			padding-top: 0.5rem;
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__count {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
