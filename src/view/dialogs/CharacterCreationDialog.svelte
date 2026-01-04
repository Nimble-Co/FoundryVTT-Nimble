<script>
	import { setContext } from 'svelte';
	import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
	import generateBlankAttributeSet from '../../utils/generateBlankAttributeSet.js';
	import scrollIntoView from '../../utils/scrollIntoView.js';

	import AncestrySelection from './components/characterCreator/AncestrySelection.svelte';
	import AncestrySizeSelection from './components/characterCreator/AncestrySizeSelection.svelte';
	import BackgroundSelection from './components/characterCreator/BackgroundSelection.svelte';
	import BonusLanguageSelection from './components/characterCreator/BonusLanguageSelection.svelte';
	import ClassSelection from './components/characterCreator/ClassSelection.svelte';
	import SkillPointAssignment from './components/characterCreator/SkillPointAssignment.svelte';
	import StartingEquipmentSelection from './components/characterCreator/StartingEquipmentSelection.svelte';
	import StatArraySelection from './components/characterCreator/StatArraySelection.svelte';
	import StatAssignment from './components/characterCreator/StatAssignment.svelte';

	const CHARACTER_CREATION_STAGES = {
		CLASS: 0,
		ANCESTRY: '1a',
		ANCESTRY_SIZE: '1b',
		BACKGROUND: 2,
		STARTING_EQUIPMENT: 3,
		ARRAY: 4,
		STATS: 5,
		SKILLS: 6,
		LANGUAGES: 7,
		SUBMIT: 8,
	};

	function getAbilityBonuses(ancestry, background, characterClass) {
		const abilityKeys = Object.keys(CONFIG.NIMBLE.abilityScores);

		const rules = [
			...(ancestry?.rules?.values() ?? []),
			...(background?.rules?.values() ?? []),
			...(characterClass?.rules?.values() ?? []),
		];

		if (!rules.length) return null;

		const statBonusRules = rules.filter((rule) => rule.type === 'abilityBonus');

		if (!rules.length) return null;

		const bonuses = new Map(abilityKeys.map((key) => [key, 0]));

		statBonusRules.forEach((rule) => {
			let targetAbilities = rule.abilities;

			if (!targetAbilities.length) return;
			if (targetAbilities.includes('all')) targetAbilities = abilityKeys;

			const bonus = getDeterministicBonus(rule.value, {});

			targetAbilities.forEach((abilityKey) => {
				bonuses.set(abilityKey, bonuses.get(abilityKey) + Number.parseInt(bonus, 10));
			});
		});

		return bonuses;
	}

	function getSkillBonuses(ancestry, background, characterClass) {
		const skillKeys = Object.keys(CONFIG.NIMBLE.skills);

		const rules = [
			...(ancestry?.rules?.values() ?? []),
			...(background?.rules?.values() ?? []),
			...(characterClass?.rules?.values() ?? []),
		];

		const skillBonusRules = rules.filter((rule) => rule.type === 'skillBonus');

		if (!rules.length) return null;

		const bonuses = new Map(skillKeys.map((key) => [key, 0]));

		skillBonusRules.forEach((rule) => {
			let targetSkills = rule.skills;

			if (!targetSkills.length) return;
			if (targetSkills.includes('all')) targetSkills = skillKeys;

			const bonus = getDeterministicBonus(rule.value, {});

			targetSkills.forEach((skillKey) => {
				bonuses.set(skillKey, bonuses.get(skillKey) + Number.parseInt(bonus, 10));
			});
		});

		return bonuses;
	}

	function getCurrentStage(
		selectedClass,
		selectedAncestry,
		selectedAncestrySize,
		selectedBackground,
		startingEquipmentChoice,
		selectedArray,
		selectedAbilityScores,
		remainingSkillPoints,
		bonusLanguages,
	) {
		const classOptionCount = classOptions.then((classes) => classes.length);

		const ancestryCount = ancestryOptions
			.then((x) => Object.values(x))
			.then((x) => x.reduce((count, category) => count + category.length, 0));

		const backgroundCount = backgroundOptions.then((backgrounds) => backgrounds.length);

		if (classOptionCount && !selectedClass) return CHARACTER_CREATION_STAGES.CLASS;

		if (ancestryCount && !selectedAncestry) {
			return CHARACTER_CREATION_STAGES.ANCESTRY;
		}

		if (selectedAncestry?.system?.size?.length > 1 && !selectedAncestrySize) {
			return CHARACTER_CREATION_STAGES.ANCESTRY_SIZE;
		}

		if (backgroundCount && !selectedBackground) {
			return CHARACTER_CREATION_STAGES.BACKGROUND;
		}

		if (!startingEquipmentChoice) return CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT;

		if (!selectedArray) return CHARACTER_CREATION_STAGES.ARRAY;

		const hasUnassignedAbilityScores = Object.values(selectedAbilityScores).some(
			(mod) => mod === null,
		);

		if (hasUnassignedAbilityScores) return CHARACTER_CREATION_STAGES.STATS;
		if (remainingSkillPoints) return CHARACTER_CREATION_STAGES.SKILLS;

		const intelligenceModifier = selectedArray.array?.[selectedAbilityScores.intelligence];

		if (
			!remainingSkillPoints &&
			intelligenceModifier > 0 &&
			bonusLanguages.length < intelligenceModifier
		) {
			return CHARACTER_CREATION_STAGES.LANGUAGES;
		}

		return CHARACTER_CREATION_STAGES.SUBMIT;
	}

	function submit() {
		dialog.submitCharacterCreation({
			name,
			origins: {
				background: selectedBackground,
				characterClass: selectedClass,
				ancestry: selectedAncestry,
			},
			startingEquipmentChoice,
			abilityScores: Object.entries(selectedAbilityScores).reduce(
				(assignedScores, [abilityKey, index]) => {
					assignedScores[`${abilityKey}.baseValue`] = selectedArray?.array?.[index] ?? 0;
					return assignedScores;
				},
				{},
			),
			sizeCategory: selectedAncestrySize,
			skills: Object.entries(assignedSkillPoints).reduce((assignedPoints, [skillKey, points]) => {
				assignedPoints[`${skillKey}.points`] = points;
				return assignedPoints;
			}, {}),
			languages: ['common', ...bonusLanguages],
		});
	}

	let {
		ancestryOptions,
		backgroundOptions,
		bonusLanguageOptions,
		classOptions,
		dialog,
		statArrayOptions,
	} = $props();

	let assignedSkillPoints = $state({});
	let bonusLanguages = $state([]);
	let selectedAbilityScores = $state(generateBlankAttributeSet());
	let name = $state('');
	let selectedArray = $state(null);
	let selectedBackground = $state('');
	let selectedClass = $state('');
	let selectedAncestry = $state('');
	let selectedAncestrySize = $state('medium');
	let startingEquipmentChoice = $state(null);

	let abilityBonuses = $derived(
		getAbilityBonuses(selectedAncestry, selectedBackground, selectedClass),
	);

	let skillBonuses = $derived(getSkillBonuses(selectedAncestry, selectedBackground, selectedClass));

	let remainingSkillPoints = $derived(
		4 - Object.values(assignedSkillPoints).reduce((a, b) => a + b, 0),
	);

	let stage = $derived(
		getCurrentStage(
			selectedClass,
			selectedAncestry,
			selectedAncestrySize,
			selectedBackground,
			startingEquipmentChoice,
			selectedArray,
			selectedAbilityScores,
			remainingSkillPoints,
			bonusLanguages,
		),
	);

	let stageNumber = $derived(stage.toString().match(/\d+/)[0]);

	setContext('dialog', dialog);
	setContext('CHARACTER_CREATION_STAGES', CHARACTER_CREATION_STAGES);

	$effect(() => {
		scrollIntoView(`${dialog.id}-stage-${stage}`);
	});
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
			bind:value={name}
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
			active={stage === CHARACTER_CREATION_STAGES.CLASS}
			{classes}
			bind:selectedClass
		/>
	{/await}

	{#await ancestryOptions then ancestries}
		<AncestrySelection
			active={stage === CHARACTER_CREATION_STAGES.ANCESTRY}
			{ancestries}
			bind:selectedAncestry
			bind:selectedAncestrySize
		/>
	{/await}

	<AncestrySizeSelection
		active={stage === CHARACTER_CREATION_STAGES.ANCESTRY_SIZE}
		{selectedAncestry}
		bind:selectedAncestrySize
	/>

	{#await backgroundOptions then backgrounds}
		<BackgroundSelection
			active={stage === CHARACTER_CREATION_STAGES.BACKGROUND}
			{backgrounds}
			bind:selectedBackground
		/>
	{/await}

	<StartingEquipmentSelection
		active={stage === CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT}
		{selectedClass}
		{selectedBackground}
		bind:startingEquipmentChoice
	/>

	<StatArraySelection
		active={stage === CHARACTER_CREATION_STAGES.ARRAY}
		bind:bonusLanguages
		bind:selectedAbilityScores
		bind:selectedArray
		{statArrayOptions}
	/>

	<StatAssignment
		active={stage === CHARACTER_CREATION_STAGES.STATS}
		bind:bonusLanguages
		{selectedArray}
		{selectedClass}
		bind:selectedAbilityScores
	/>

	<SkillPointAssignment
		active={stage === CHARACTER_CREATION_STAGES.SKILLS}
		bind:assignedSkillPoints
		{abilityBonuses}
		{remainingSkillPoints}
		{selectedAbilityScores}
		{selectedArray}
		{skillBonuses}
	/>

	<BonusLanguageSelection
		active={stage === CHARACTER_CREATION_STAGES.LANGUAGES}
		bind:bonusLanguages
		{bonusLanguageOptions}
		{remainingSkillPoints}
		{selectedArray}
		{selectedAbilityScores}
	/>
</article>

<footer class="nimble-sheet__footer nimble-sheet__footer--character-creator">
	<div class="nimble-progress-bar nimble-progress-bar--stage-{stageNumber}">
		<span class="nimble-progress-bar__label"> {stageNumber} / 8 </span>
	</div>

	<button
		class="nimble-button"
		data-button-variant="basic"
		data-tooltip={stage !== CHARACTER_CREATION_STAGES['SUBMIT']
			? game.i18n.localize(CONFIG.NIMBLE.characterCreation.incompleteStepsWarning)
			: null}
		data-tooltip-direction="UP"
		onclick={submit}
	>
		{game.i18n.localize(CONFIG.NIMBLE.characterCreation.createCharacter)}

		{#if stage !== CHARACTER_CREATION_STAGES['SUBMIT']}
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
