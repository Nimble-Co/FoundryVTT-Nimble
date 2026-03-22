<script lang="ts">
	import type { CharacterCreationDialogProps } from './characterCreation/types.js';

	import { setContext, untrack } from 'svelte';

	import { CHARACTER_CREATION_STAGES } from './characterCreation/constants.js';
	import { createCharacterCreationState } from './characterCreation/state.svelte.js';
	import { isRaisedByBackground } from './characterCreation/utils.js';

	import AncestrySelection from './components/characterCreator/AncestrySelection.svelte';
	import AncestrySizeSelection from './components/characterCreator/AncestrySizeSelection.svelte';
	import BackgroundOptionsSelection from './components/characterCreator/BackgroundOptionsSelection.svelte';
	import BackgroundSelection from './components/characterCreator/BackgroundSelection.svelte';
	import BonusLanguageSelection from './components/characterCreator/BonusLanguageSelection.svelte';
	import ClassFeatureSelection from './components/characterCreator/ClassFeatureSelection.svelte';
	import ClassSelection from './components/characterCreator/ClassSelection.svelte';
	import SkillPointAssignment from './components/characterCreator/SkillPointAssignment.svelte';
	import StartingEquipmentSelection from './components/characterCreator/StartingEquipmentSelection.svelte';
	import StatArraySelection from './components/characterCreator/StatArraySelection.svelte';
	import StatAssignment from './components/characterCreator/StatAssignment.svelte';

	let {
		ancestryOptions,
		backgroundOptions,
		bonusLanguageOptions,
		classOptions,
		dialog,
		statArrayOptions,
	}: CharacterCreationDialogProps = $props();

	const state = createCharacterCreationState({
		get ancestryOptions() {
			return ancestryOptions;
		},
		get backgroundOptions() {
			return backgroundOptions;
		},
		get classOptions() {
			return classOptions;
		},
		get dialog() {
			return dialog;
		},
	});

	setContext('CHARACTER_CREATION_STAGES', CHARACTER_CREATION_STAGES);
	setContext(
		'dialog',
		untrack(() => dialog),
	);
</script>

<header class="nimble-sheet__header nimble-sheet__header--character-creator">
	<label class="nimble-field nimble-field--full-width" data-field-variant="stacked">
		<span class="nimble-heading nimble-field__label" data-heading-variant="field">
			{game.i18n.localize(CONFIG.NIMBLE.characterCreation.characterName)}
		</span>

		<input
			autocomplete="off"
			spellcheck="false"
			type="text"
			bind:value={state.name}
			placeholder={game.i18n.localize(CONFIG.NIMBLE.characterCreation.newCharacterPlaceholder)}
		/>
	</label>
</header>

<article
	class="nimble-sheet__body nimble-sheet__body--character-creator"
	style="scroll-behavior: smooth;"
>
	{#await classOptions then classes}
		<ClassSelection
			active={state.stage === CHARACTER_CREATION_STAGES.CLASS}
			{classes}
			bind:selectedClass={state.selectedClass}
		/>
	{/await}

	<ClassFeatureSelection
		active={state.stage === CHARACTER_CREATION_STAGES.CLASS_FEATURES}
		classFeatures={state.classFeatures}
		bind:selectedFeatures={state.selectedClassFeatures}
	/>

	{#await ancestryOptions then ancestries}
		<AncestrySelection
			active={state.stage === CHARACTER_CREATION_STAGES.ANCESTRY}
			{ancestries}
			bind:selectedAncestry={state.selectedAncestry}
			bind:selectedAncestrySize={state.selectedAncestrySize}
		/>
	{/await}

	<AncestrySizeSelection
		active={state.stage === CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS}
		selectedAncestry={state.selectedAncestry}
		selectedClass={state.selectedClass}
		bind:selectedAncestrySize={state.selectedAncestrySize}
		bind:selectedAncestrySave={state.selectedAncestrySave}
	/>

	{#await backgroundOptions then backgrounds}
		<BackgroundSelection
			active={state.stage === CHARACTER_CREATION_STAGES.BACKGROUND}
			{backgrounds}
			bind:selectedBackground={state.selectedBackground}
		/>
	{/await}

	{#if isRaisedByBackground(state.selectedBackground)}
		<BackgroundOptionsSelection
			active={state.stage === CHARACTER_CREATION_STAGES.BACKGROUND_OPTIONS}
			{ancestryOptions}
			selectedBackground={state.selectedBackground}
			bind:selectedRaisedByAncestry={state.selectedRaisedByAncestry}
		/>
	{/if}

	<StartingEquipmentSelection
		active={state.stage === CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT}
		selectedClass={state.selectedClass}
		selectedBackground={state.selectedBackground}
		bind:startingEquipmentChoice={state.startingEquipmentChoice}
	/>

	<StatArraySelection
		active={state.stage === CHARACTER_CREATION_STAGES.ARRAY}
		bind:bonusLanguages={state.bonusLanguages}
		bind:selectedAbilityScores={state.selectedAbilityScores}
		bind:selectedArray={state.selectedArray}
		{statArrayOptions}
	/>

	<StatAssignment
		active={state.stage === CHARACTER_CREATION_STAGES.STATS}
		bind:bonusLanguages={state.bonusLanguages}
		selectedAncestry={state.selectedAncestry}
		selectedArray={state.selectedArray}
		selectedAncestrySave={state.selectedAncestrySave}
		selectedClass={state.selectedClass}
		bind:selectedAbilityScores={state.selectedAbilityScores}
	/>

	<SkillPointAssignment
		active={state.stage === CHARACTER_CREATION_STAGES.SKILLS}
		bind:assignedSkillPoints={state.assignedSkillPoints}
		abilityBonuses={state.abilityBonuses}
		skillBonuses={state.skillBonuses}
		remainingSkillPoints={state.remainingSkillPoints}
		selectedAbilityScores={state.selectedAbilityScores}
		selectedArray={state.selectedArray}
	/>

	<BonusLanguageSelection
		active={state.stage === CHARACTER_CREATION_STAGES.LANGUAGES}
		bind:bonusLanguages={state.bonusLanguages}
		{bonusLanguageOptions}
		grantedLanguages={state.grantedLanguages}
		remainingSkillPoints={state.remainingSkillPoints}
		selectedArray={state.selectedArray}
		selectedAbilityScores={state.selectedAbilityScores}
	/>
</article>

<footer class="nimble-sheet__footer nimble-sheet__footer--character-creator">
	<div class="nimble-progress-bar nimble-progress-bar--stage-{state.stageNumber}">
		<span class="nimble-progress-bar__label"> {state.stageNumber} / 8 </span>
	</div>

	<button
		class="nimble-button"
		data-button-variant="basic"
		data-tooltip={state.stage !== CHARACTER_CREATION_STAGES['SUBMIT']
			? game.i18n.localize(CONFIG.NIMBLE.characterCreation.incompleteStepsWarning)
			: null}
		data-tooltip-direction="UP"
		onclick={state.handleCreateCharacter}
	>
		{game.i18n.localize(CONFIG.NIMBLE.characterCreation.createCharacter)}

		{#if state.stage !== CHARACTER_CREATION_STAGES['SUBMIT']}
			<i class="nimble-button__icon fa-solid fa-triangle-exclamation" data-icon-style="warning"></i>
		{/if}
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__body {
		--nimble-card-content-grid: 'img title';
		--nimble-card-column-dimensions: 2.5rem 1fr;
		--nimble-card-row-dimensions: max-content;
		--nimble-card-title-alignment: center;
		--nimble-card-width: fit-content;
		--nimble-card-min-width: 8rem;
		--nimble-card-padding: 0 0.5rem 0 0;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.125rem 0.5rem;
	}

	.nimble-progress-bar {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		position: relative;
		overflow: hidden;
		flex-grow: 1;
		height: 2rem;
		background-color: #474645;
		border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		border-radius: 4px;

		&::after {
			content: '';
			grid-column-start: 1;
			box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
			background: linear-gradient(to right, hsl(138, 47%, 20%) 0%, hsl(139, 47%, 44%) 100%);
		}

		&--stage-0::after {
			width: 0;
		}

		@for $i from 1 through 8 {
			&--stage-#{$i}::after {
				grid-column-end: $i + 1;
			}
		}

		&__label {
			position: absolute;
			top: 50%;
			left: 50%;
			color: #fff;
			text-shadow: 0 0 4px black;
			transform: translate(-50%, -50%);
		}
	}
</style>
