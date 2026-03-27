<script lang="ts">
	import type { SpellGrantDisplayProps } from '#types/components/SpellGrantDisplay.d.ts';
	import type { SpellIndexEntry } from '#utils/getSpells.js';

	import { getContext } from 'svelte';

	import localize from '#utils/localize.js';
	import Hint from '../../../components/Hint.svelte';
	import SchoolSelection from './SchoolSelection.svelte';
	import SpellCard from './SpellCard.svelte';
	import SpellSelection from './SpellSelection.svelte';

	let {
		active,
		spellGrants,
		spellIndex,
		selectedSchools = $bindable(),
		selectedSpells = $bindable(),
	}: SpellGrantDisplayProps = $props();

	const CHARACTER_CREATION_STAGES = getContext<Record<string, string | number>>(
		'CHARACTER_CREATION_STAGES',
	);
	const dialog = getContext<{ id: string }>('dialog');

	function handleSchoolSelect(ruleId: string, schools: string[]) {
		const newMap = new Map(selectedSchools);
		newMap.set(ruleId, schools);
		selectedSchools = newMap;
	}

	function handleSpellSelect(ruleId: string, spellUuids: string[]) {
		const newMap = new Map(selectedSpells);
		newMap.set(ruleId, spellUuids);
		selectedSpells = newMap;
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

	const hasAutoGrant = $derived((spellGrants?.autoGrant?.length ?? 0) > 0);
	const hasSchoolSelections = $derived((spellGrants?.schoolSelections?.length ?? 0) > 0);
	const hasSpellSelections = $derived((spellGrants?.spellSelections?.length ?? 0) > 0);

	// Sort auto-granted spells by school then name
	const sortedAutoGrant = $derived(
		spellGrants?.autoGrant ? sortSpellsBySchoolThenName(spellGrants.autoGrant) : [],
	);
</script>

{#if spellGrants?.hasGrants && spellIndex}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.SPELLS}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.spellGrants.header')}
			</h3>
		</header>

		{#if active}
			<Hint hintText={localize('NIMBLE.spellGrants.hint')} />
		{/if}

		{#if hasAutoGrant}
			<div class="spell-grants__auto-grant">
				<h4 class="spell-grants__subheader nimble-heading" data-heading-variant="subsection">
					{localize('NIMBLE.spellGrants.grantedSpells')}
				</h4>
				<ul class="spell-grants__list">
					{#each sortedAutoGrant as spell (spell.uuid)}
						<SpellCard {spell} />
					{/each}
				</ul>
			</div>
		{/if}

		{#if hasSchoolSelections}
			{#each spellGrants.schoolSelections as group (group.ruleId)}
				<SchoolSelection
					{group}
					{spellIndex}
					selected={selectedSchools.get(group.ruleId) ?? []}
					onSelect={(schools) => handleSchoolSelect(group.ruleId, schools)}
				/>
			{/each}
		{/if}

		{#if hasSpellSelections}
			{#each spellGrants.spellSelections as group (group.ruleId)}
				<SpellSelection
					{group}
					selected={selectedSpells.get(group.ruleId) ?? []}
					onSelect={(spellUuids) => handleSpellSelect(group.ruleId, spellUuids)}
				/>
			{/each}
		{/if}
	</section>
{/if}

<style lang="scss">
	.spell-grants {
		&__auto-grant {
			margin-top: 0.5rem;
		}

		&__subheader {
			margin: 0 0 0.5rem 0;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}
	}
</style>
