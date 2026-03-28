<script lang="ts">
	import type { SpellGrantDisplayProps } from '#types/components/SpellGrantDisplay.d.ts';
	import { getSpellsFromIndex, type SpellIndexEntry } from '#utils/getSpells.js';

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
		confirmedSchools = $bindable(),
		sourceFilter,
		header,
		sectionId,
	}: SpellGrantDisplayProps = $props();

	const CHARACTER_CREATION_STAGES = getContext<Record<string, string | number>>(
		'CHARACTER_CREATION_STAGES',
	);
	const dialog = getContext<{ id: string }>('dialog');

	// Track whether section is expanded (for editing)
	let isEditing = $state(false);

	function handleSchoolSelect(ruleId: string, schools: string[]) {
		const newMap = new Map(selectedSchools);
		newMap.set(ruleId, schools);
		selectedSchools = newMap;
	}

	function handleSchoolConfirm(ruleId: string) {
		confirmedSchools = new Set([...confirmedSchools, ruleId]);
	}

	function handleSpellSelect(ruleId: string, spellUuids: string[]) {
		const newMap = new Map(selectedSpells);
		newMap.set(ruleId, spellUuids);
		selectedSpells = newMap;
	}

	// Filter selections by source if sourceFilter is provided
	const filteredSchoolSelections = $derived(
		sourceFilter
			? (spellGrants?.schoolSelections ?? []).filter((g) => g.source === sourceFilter)
			: (spellGrants?.schoolSelections ?? []),
	);

	const filteredSpellSelections = $derived(
		sourceFilter
			? (spellGrants?.spellSelections ?? []).filter((g) => g.source === sourceFilter)
			: (spellGrants?.spellSelections ?? []),
	);

	// Auto-grants - only show for class source or no filter
	const autoGrantSpells = $derived(
		sourceFilter === 'class' || !sourceFilter ? (spellGrants?.autoGrant ?? []) : [],
	);

	// Sort auto-granted spells by school then name
	const sortedAutoGrant = $derived(
		[...autoGrantSpells].sort((a, b) => {
			const schoolCompare = a.school.localeCompare(b.school);
			if (schoolCompare !== 0) return schoolCompare;
			return a.name.localeCompare(b.name);
		}),
	);

	// Check if there's anything to show
	const hasSchoolSelections = $derived(filteredSchoolSelections.length > 0);
	const hasSpellSelections = $derived(filteredSpellSelections.length > 0);
	const hasAutoGrants = $derived(autoGrantSpells.length > 0);
	const hasAnyGrants = $derived(hasSchoolSelections || hasSpellSelections || hasAutoGrants);
	// Check if there are any selections that require user choice
	const hasAnySelections = $derived(hasSchoolSelections || hasSpellSelections);

	// Check if all selections are complete AND confirmed
	const allSelectionsComplete = $derived.by(() => {
		// Check school selections are complete AND confirmed
		for (const group of filteredSchoolSelections) {
			const selected = selectedSchools.get(group.ruleId) ?? [];
			const requiredCount = Math.min(group.count, group.availableSchools.length);
			if (selected.length < requiredCount) return false;
			if (!confirmedSchools.has(group.ruleId)) return false;
		}
		// Check spell selections
		for (const group of filteredSpellSelections) {
			const selected = selectedSpells.get(group.ruleId) ?? [];
			const requiredCount = Math.min(group.count, group.availableSpells.length);
			if (selected.length < requiredCount) return false;
		}
		return true;
	});

	// Group auto-granted spells by school for display
	const autoGrantsBySchool = $derived.by(() => {
		const grouped = new Map<string, SpellIndexEntry[]>();
		for (const spell of sortedAutoGrant) {
			const existing = grouped.get(spell.school) ?? [];
			existing.push(spell);
			grouped.set(spell.school, existing);
		}
		return grouped;
	});

	// Determine section ID for scroll targeting
	const effectiveSectionId = $derived(
		sectionId ?? `${dialog.id}-stage-${CHARACTER_CREATION_STAGES.SPELLS}`,
	);

	// Determine header text
	const headerText = $derived(header ?? localize('NIMBLE.spellGrants.header'));

	// Show expanded view when active or editing
	const showExpanded = $derived(active || isEditing);

	function handleEditClick() {
		isEditing = true;
		// Clear confirmed schools so user can edit again
		confirmedSchools = new Set();
	}
</script>

{#if hasAnyGrants && spellIndex}
	<section class="nimble-character-creation-section" id={effectiveSectionId}>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				{headerText}

				{#if !active && allSelectionsComplete}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label={localize('NIMBLE.spellGrants.editSelection')}
						data-tooltip={localize('NIMBLE.spellGrants.editSelection')}
						onclick={handleEditClick}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</h3>
		</header>

		{#if showExpanded}
			{#if active && hasAnySelections}
				<Hint hintText={localize('NIMBLE.spellGrants.hint')} />
			{/if}

			{#if hasAutoGrants}
				{#if hasAnySelections}
					<!-- Show as expandable SpellCard when there are selections to make -->
					<div class="spell-grants__auto-grant">
						<h4
							class="spell-grants__auto-grant-label nimble-heading"
							data-heading-variant="subsection"
						>
							{localize('NIMBLE.spellGrants.grantedSpells')}
						</h4>
						<ul class="spell-grants__spell-list">
							{#each sortedAutoGrant as spell (spell.uuid)}
								<SpellCard {spell} />
							{/each}
						</ul>
					</div>
				{:else}
					<!-- Show as completed nimble-cards when only auto-grants (no selections) -->
					{#each [...autoGrantsBySchool.entries()] as [school, spells] (school)}
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

			{#if hasSchoolSelections}
				{#each filteredSchoolSelections as group (group.ruleId)}
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
							onSelect={(schools) => handleSchoolSelect(group.ruleId, schools)}
							isConfirmed={false}
							onConfirm={() => handleSchoolConfirm(group.ruleId)}
						/>
					{/if}
				{/each}
			{/if}

			{#if hasSpellSelections}
				{#each filteredSpellSelections as group (group.ruleId)}
					<SpellSelection
						{group}
						selected={selectedSpells.get(group.ruleId) ?? []}
						onSelect={(spellUuids) => handleSpellSelect(group.ruleId, spellUuids)}
					/>
				{/each}
			{/if}
		{:else if allSelectionsComplete}
			<!-- Show granted spells grouped by school -->
			{#each [...autoGrantsBySchool.entries()] as [school, spells] (school)}
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
			{#each filteredSchoolSelections as group (group.ruleId)}
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
			{#each filteredSpellSelections as group (group.ruleId)}
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
			margin: 0;
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
			margin: 0 0 0.5rem 0;
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
