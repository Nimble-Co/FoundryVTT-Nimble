<script lang="ts">
	import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
	import type { LevelUpSchoolSelection } from '../../CharacterLevelUpDialogState.svelte.ts';

	import { getSpellsFromIndex } from '#utils/getSpellsFromIndex.js';
	import localize from '#utils/localize.js';
	import Hint from '../../../components/Hint.svelte';
	import SchoolSelection from '../characterCreator/SchoolSelection.svelte';
	import LevelUpSpellCard from './LevelUpSpellCard.svelte';

	interface LevelUpSpellGrantsProps {
		spells: SpellIndexEntry[];
		schoolSelections: LevelUpSchoolSelection[];
		spellIndex: SpellIndex | null;
		selectedSchools: Map<string, string[]>;
		confirmedSchools: Set<string>;
		onSchoolsChange: (schools: Map<string, string[]>) => void;
		onConfirmedChange: (confirmed: Set<string>) => void;
	}

	let {
		spells,
		schoolSelections,
		spellIndex,
		selectedSchools,
		confirmedSchools,
		onSchoolsChange,
		onConfirmedChange,
	}: LevelUpSpellGrantsProps = $props();

	const hasAnyGrants = $derived(spells.length > 0 || schoolSelections.length > 0);

	const spellsBySchool = $derived.by(() => {
		const grouped = new Map<string, SpellIndexEntry[]>();
		for (const spell of spells) {
			const existing = grouped.get(spell.school) ?? [];
			existing.push(spell);
			grouped.set(spell.school, existing);
		}
		return grouped;
	});

	function handleSchoolSelect(ruleId: string, schools: string[]) {
		const newMap = new Map(selectedSchools);
		newMap.set(ruleId, schools);
		onSchoolsChange(newMap);
	}

	function handleSchoolConfirm(ruleId: string) {
		const newSet = new Set([...confirmedSchools, ruleId]);
		onConfirmedChange(newSet);
	}
</script>

{#if hasAnyGrants}
	<section class="level-up-spell-grants">
		<header>
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.spellGrants.levelUpHeader')}
			</h3>
		</header>

		<Hint hintText={localize('NIMBLE.spellGrants.levelUpHint')} />

		{#if spells.length > 0}
			{#each [...spellsBySchool.entries()] as [school, schoolSpells] (school)}
				<div class="level-up-spell-grants__school-group">
					<h4
						class="level-up-spell-grants__school-label nimble-heading"
						data-heading-variant="subsection"
					>
						{localize('NIMBLE.spellGrants.grantedSchoolLabel')}: ({localize(
							CONFIG.NIMBLE.spellSchools[school] ?? school,
						)})
					</h4>
					<ul class="level-up-spell-grants__spell-list">
						{#each schoolSpells as spell (spell.uuid)}
							<LevelUpSpellCard {spell} />
						{/each}
					</ul>
				</div>
			{/each}
		{/if}

		{#if schoolSelections.length > 0 && spellIndex}
			{#each schoolSelections as group (group.ruleId)}
				{#if confirmedSchools.has(group.ruleId)}
					{@const schools = selectedSchools.get(group.ruleId) ?? []}
					{@const schoolSpells = getSpellsFromIndex(spellIndex, schools, group.tiers, {
						utilityOnly: group.utilityOnly,
						forClass: group.forClass,
					})}
					<div class="level-up-spell-grants__confirmed-group">
						<div class="level-up-spell-grants__confirmed-header">
							<span class="level-up-spell-grants__confirmed-label">
								{localize('NIMBLE.spellGrants.selectedSchoolLabel')}: {schools
									.map((s) => localize(CONFIG.NIMBLE.spellSchools[s] ?? s))
									.join(', ')}
							</span>
							<button
								type="button"
								class="level-up-spell-grants__edit-button"
								aria-label={localize('NIMBLE.spellGrants.changeSelection')}
								onclick={() => {
									const newSet = new Set([...confirmedSchools].filter((id) => id !== group.ruleId));
									onConfirmedChange(newSet);
								}}
							>
								<i class="fa-solid fa-edit"></i>
							</button>
						</div>
						<ul class="level-up-spell-grants__spell-list">
							{#each schoolSpells as spell (spell.uuid)}
								<LevelUpSpellCard {spell} />
							{/each}
						</ul>
					</div>
				{:else}
					<SchoolSelection
						{group}
						{spellIndex}
						selected={selectedSchools.get(group.ruleId) ?? []}
						onSelect={(schools) => handleSchoolSelect(group.ruleId, schools)}
						isConfirmed={false}
						onConfirm={() => handleSchoolConfirm(group.ruleId)}
					/>
				{/if}
			{/each}
		{/if}
	</section>
{/if}

<style lang="scss">
	.level-up-spell-grants {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 1rem 0;
		}

		&__school-group {
			margin-bottom: 1rem;

			&:last-child {
				margin-bottom: 0;
			}
		}

		&__school-label {
			margin: 0 0 0.5rem 0;
		}

		&__spell-list {
			display: flex;
			flex-direction: column;
			margin: 0.5rem 0 0 0;
			padding: 0;
		}

		&__confirmed-group {
			margin-top: 0.75rem;
			padding: 0.75rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__confirmed-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}

		&__confirmed-label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__edit-button {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			font-size: var(--nimble-sm-text);
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-medium-text-color);
			transition: var(--nimble-standard-transition);

			&:hover {
				border-color: var(--nimble-accent-color);
				color: var(--nimble-dark-text-color);
			}
		}
	}
</style>
