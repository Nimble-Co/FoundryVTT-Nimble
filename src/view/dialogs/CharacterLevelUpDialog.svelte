<script lang="ts">
	import type { CharacterLevelUpDialogProps } from '#types/components/CharacterLevelUpDialog.d.ts';

	import AbilityScoreIncrease from './components/levelUpHelper/AbilityScoreIncrease.svelte';
	import EpicBoonSelection from './components/levelUpHelper/EpicBoonSelection.svelte';
	import HitPointSelection from './components/levelUpHelper/HitPointSelection.svelte';
	import LevelUpClassFeatureSelection from './components/levelUpHelper/LevelUpClassFeatureSelection.svelte';
	import LevelUpSpellGrants from './components/levelUpHelper/LevelUpSpellGrants.svelte';
	import SkillPointAssignment from './components/levelUpHelper/SkillPointAssignment.svelte';
	import SubclassSelection from './components/levelUpHelper/SubclassSelection.svelte';
	import { createLevelUpState } from './CharacterLevelUpDialogState.svelte.ts';
	import { SUBCLASS_LEVEL, EPIC_BOON_LEVEL } from './const/levelUpConstants.ts';

	let { document, dialog }: CharacterLevelUpDialogProps = $props();

	const { forms } = CONFIG.NIMBLE;

	const state = createLevelUpState(
		() => document,
		() => dialog,
	);

	const { boons, submit, getSubmitButtonTooltip, getSubmitButtonAriaLabel } = state;
	const characterClass = $derived(state.characterClass);
	const levelingTo = $derived(state.levelingTo);
	const subclasses = $derived(state.subclasses);
	const epicBoons = $derived(state.epicBoons);
	const classFeatures = $derived(state.classFeatures);
	const featuresLoading = $derived(state.featuresLoading);
	const autoGrantedSpells = $derived(state.autoGrantedSpells);
	const isComplete = $derived(state.isComplete);
</script>

<section class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.75rem;">
	<HitPointSelection {document} bind:hitPointRollSelection={state.hitPointRollSelection} />

	<AbilityScoreIncrease
		{boons}
		{characterClass}
		{document}
		{levelingTo}
		bind:chooseBoon={state.chooseBoon}
		bind:selectedAbilityScores={state.selectedAbilityScores}
		bind:selectedBoon={state.selectedBoon}
		bind:hasStatIncrease={state.hasStatIncrease}
	/>

	<SkillPointAssignment
		chooseBoon={state.chooseBoon}
		{document}
		selectedBoon={state.selectedBoon}
		selectedAbilityScore={state.selectedAbilityScores}
		bind:skillPointChanges={state.skillPointChanges}
		bind:selectedAbilityScores={state.selectedAbilityScores}
		bind:skillPointsOverMax={state.skillPointsOverMax}
	/>

	{#if levelingTo === SUBCLASS_LEVEL && subclasses.length}
		<SubclassSelection {subclasses} bind:selectedSubclass={state.selectedSubclass} />
	{/if}

	{#if levelingTo === EPIC_BOON_LEVEL && epicBoons.length}
		<EpicBoonSelection {epicBoons} bind:selectedEpicBoon={state.selectedEpicBoon} />
	{/if}

	<LevelUpClassFeatureSelection
		{classFeatures}
		bind:selectedFeatures={state.selectedClassFeatures}
		bind:selectedOptionIds={state.selectedFeatureOptions}
		bind:selectedOptionSubItems={state.selectedOptionSubItems}
		ownedItemUuids={state.ownedFeatureUuids}
		loading={featuresLoading}
	/>

	<LevelUpSpellGrants
		spells={autoGrantedSpells}
		schoolSelections={state.schoolSelections}
		spellSelections={state.spellSelections}
		spellIndex={state.resolvedSpellIndex}
		selectedSchools={state.selectedSchools}
		selectedSpells={state.selectedSpells}
		confirmedSchools={state.confirmedSchools}
		onSchoolsChange={(schools) => (state.selectedSchools = schools)}
		onSpellsChange={(spells) => (state.selectedSpells = spells)}
		onConfirmedChange={(confirmed) => (state.confirmedSchools = confirmed)}
	/>
</section>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		aria-label={getSubmitButtonAriaLabel()}
		data-tooltip={getSubmitButtonTooltip()}
		onclick={submit}
		disabled={!isComplete}
	>
		{forms.submit}
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.nimble-button[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
