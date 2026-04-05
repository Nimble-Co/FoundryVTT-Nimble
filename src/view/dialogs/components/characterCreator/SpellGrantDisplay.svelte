<script lang="ts">
	import type { SpellGrantDisplayProps } from '#types/components/SpellGrantDisplay.d.ts';
	import { getSpellsFromIndex } from '#utils/getSpellsFromIndex.js';
	import localize from '#utils/localize.js';
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';
	import SchoolSelection from './SchoolSelection.svelte';
	import SpellCard from './SpellCard.svelte';
	import {
		createSpellGrantDisplayState,
		type SpellGrantDisplayContext,
	} from './SpellGrantDisplay.svelte.ts';
	import SpellSelection from './SpellSelection.svelte';

	let {
		active,
		spellGrants,
		spellIndex,
		selectedSchools = $bindable(),
		selectedSpells = $bindable(),
		confirmedSchools = $bindable(),
		sourceFilter,
		header,
		sectionId,
	}: SpellGrantDisplayProps = $props();

	const contextData: SpellGrantDisplayContext = {
		CHARACTER_CREATION_STAGES: getContext<Record<string, string | number>>(
			'CHARACTER_CREATION_STAGES',
		),
		dialog: getContext<{ id: string }>('dialog'),
	};

	function getHintKey(source: typeof sourceFilter): string {
		switch (source) {
			case 'class':
				return 'NIMBLE.spellGrants.hintClass';
			case 'background':
				return 'NIMBLE.spellGrants.hintBackground';
			default:
				return 'NIMBLE.spellGrants.hintAncestry';
		}
	}

	const state = createSpellGrantDisplayState({
		props: () => ({
			active,
			spellGrants,
			spellIndex,
			selectedSchools,
			selectedSpells,
			confirmedSchools,
			sourceFilter,
			header,
			sectionId,
		}),
		context: contextData,
		onSchoolsChange: (schools) => (selectedSchools = schools),
		onSpellsChange: (spells) => (selectedSpells = spells),
		onConfirmedChange: (confirmed) => (confirmedSchools = confirmed),
	});
</script>

{#if state.hasAnyGrants && spellIndex}
	<section class="nimble-character-creation-section" id={state.effectiveSectionId}>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				{state.headerText}

				{#if !active && state.allSelectionsComplete}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label={localize('NIMBLE.spellGrants.editSelection')}
						data-tooltip={localize('NIMBLE.spellGrants.editSelection')}
						onclick={state.handleEditClick}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</h3>
		</header>

		{#if state.showExpanded}
			{#if active && state.hasAnySelections}
				<Hint hintText={localize(getHintKey(sourceFilter))} />
			{/if}

			{#if state.hasAutoGrants}
				{#if state.hasAnySelections}
					<!-- Show as expandable SpellCard when there are selections to make -->
					<div class="spell-grants__auto-grant">
						<h4
							class="spell-grants__auto-grant-label nimble-heading"
							data-heading-variant="subsection"
						>
							{localize('NIMBLE.spellGrants.grantedSpells')}
						</h4>
						<ul class="spell-grants__spell-list">
							{#each state.sortedAutoGrant as spell (spell.uuid)}
								<SpellCard {spell} />
							{/each}
						</ul>
					</div>
				{:else}
					<!-- Show as completed nimble-cards when only auto-grants (no selections) -->
					{#each [...state.autoGrantsBySchool.entries()] as [school, spells] (school)}
						<div class="spell-grants__school-group">
							<h4
								class="spell-grants__school-label nimble-heading"
								data-heading-variant="subsection"
							>
								{localize('NIMBLE.spellGrants.grantedSchoolLabel')}: ({localize(
									CONFIG.NIMBLE.spellSchools[school] ?? school,
								)})
							</h4>
							<ul class="spell-grants__summary-list">
								{#each spells as spell (spell.uuid)}
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
						</div>
					{/each}
				{/if}
			{/if}

			{#if state.hasSchoolSelections}
				{#each state.filteredSchoolSelections as group (group.ruleId)}
					{#if confirmedSchools.has(group.ruleId)}
						<!-- Show confirmed spells for this school selection -->
						{@const schools = selectedSchools.get(group.ruleId) ?? []}
						{@const schoolSpells = spellIndex
							? getSpellsFromIndex(spellIndex, schools, group.tiers, {
									utilityOnly: group.utilityOnly,
									forClass: group.forClass,
								})
							: []}
						<div class="spell-grants__confirmed-group">
							<div class="spell-grants__confirmed-header">
								<span class="spell-grants__confirmed-label">
									{localize('NIMBLE.spellGrants.selectedSchoolLabel')}: {schools
										.map((s) => localize(CONFIG.NIMBLE.spellSchools[s] ?? s))
										.join(', ')}
								</span>
								<button
									type="button"
									class="spell-grants__edit-button"
									aria-label={localize('NIMBLE.spellGrants.changeSelection')}
									onclick={() => {
										confirmedSchools = new Set(
											[...confirmedSchools].filter((id) => id !== group.ruleId),
										);
									}}
								>
									<i class="fa-solid fa-edit"></i>
								</button>
							</div>
							<ul class="spell-grants__confirmed-spells">
								{#each schoolSpells as spell (spell.uuid)}
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
						</div>
					{:else}
						<SchoolSelection
							{group}
							{spellIndex}
							selected={selectedSchools.get(group.ruleId) ?? []}
							onSelect={(schools) => state.handleSchoolSelect(group.ruleId, schools)}
							isConfirmed={false}
							onConfirm={() => state.handleSchoolConfirm(group.ruleId)}
						/>
					{/if}
				{/each}
			{/if}

			{#if state.hasSpellSelections}
				{#each state.filteredSpellSelections as group (group.ruleId)}
					<SpellSelection
						{group}
						selected={selectedSpells.get(group.ruleId) ?? []}
						onSelect={(spellUuids) => state.handleSpellSelect(group.ruleId, spellUuids)}
					/>
				{/each}
			{/if}
		{:else if state.allSelectionsComplete}
			<!-- Show granted spells grouped by school -->
			{#each [...state.autoGrantsBySchool.entries()] as [school, spells] (school)}
				<div class="spell-grants__school-group">
					<h4 class="spell-grants__school-label nimble-heading" data-heading-variant="subsection">
						{localize('NIMBLE.spellGrants.grantedSchoolLabel')}: ({localize(
							CONFIG.NIMBLE.spellSchools[school] ?? school,
						)})
					</h4>
					<ul class="spell-grants__summary-list">
						{#each spells as spell (spell.uuid)}
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
				</div>
			{/each}

			<!-- Show selected school spells -->
			{#each state.filteredSchoolSelections as group (group.ruleId)}
				{@const schools = selectedSchools.get(group.ruleId) ?? []}
				{@const schoolSpells = spellIndex
					? getSpellsFromIndex(spellIndex, schools, group.tiers, {
							utilityOnly: group.utilityOnly,
							forClass: group.forClass,
						})
					: []}
				{#if schools.length > 0}
					<div class="spell-grants__school-group">
						<h4 class="spell-grants__school-label nimble-heading" data-heading-variant="subsection">
							{localize('NIMBLE.spellGrants.selectedSchoolLabel')}: ({schools
								.map((s) => localize(CONFIG.NIMBLE.spellSchools[s] ?? s))
								.join(', ')})
						</h4>
						<ul class="spell-grants__summary-list">
							{#each schoolSpells as spell (spell.uuid)}
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
					</div>
				{/if}
			{/each}

			<!-- Show selected individual spells (from spell selections like Academy Dropout) -->
			{#each state.filteredSpellSelections as group (group.ruleId)}
				{@const spellUuids = selectedSpells.get(group.ruleId) ?? []}
				{@const spells = spellUuids
					.map((uuid) => group.availableSpells.find((s) => s.uuid === uuid))
					.filter(Boolean)}
				{#if spells.length > 0}
					<div class="spell-grants__school-group">
						<h4 class="spell-grants__school-label nimble-heading" data-heading-variant="subsection">
							{localize('NIMBLE.spellGrants.selectedSpellLabel')}:
						</h4>
						<ul class="spell-grants__summary-list">
							{#each spells as spell (spell.uuid)}
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
					</div>
				{/if}
			{/each}
		{/if}
	</section>
{/if}

<style lang="scss">
	.spell-grants {
		&__auto-grant {
			margin-bottom: 1rem;
		}

		&__auto-grant-label {
			margin: 0 0 0.5rem 0;
		}

		&__spell-list {
			display: flex;
			flex-direction: column;
			gap: 0;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__summary-list {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin: 0.375rem 0 0 0;
			padding: 0;
			list-style: none;
		}

		&__school-group {
			margin-bottom: 1rem;

			&:last-child {
				margin-bottom: 0;
			}
		}

		&__school-label {
			margin: 0 0 1rem 0;
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
			margin-bottom: 0.375rem;
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

		&__confirmed-spells {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}
	}
</style>
