<script lang="ts">
	import generateBlankSkillSet from '../../utils/generateBlankSkillSet.js';
	import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';

	import getSubclassChoices from '../../utils/getSubclassChoices.js';

	import AbilityScoreIncrease from './components/levelUpHelper/AbilityScoreIncrease.svelte';
	import HitPointSelection from './components/levelUpHelper/HitPointSelection.svelte';
	import SkillPointAssignment from './components/levelUpHelper/SkillPointAssignment.svelte';
	import SubclassSelection from './components/levelUpHelper/SubclassSelection.svelte';

	function submit() {
		dialog.submit({
			selectedAbilityScore: selectedAbilityScores,
			selectedSubclass,
			skillPointChanges,
			takeAverageHp: hitPointRollSelection === 'average',
		});
	}

	let { document, dialog, ...data } = $props();

	const characterClass: NimbleClassItem | undefined = Object.values(document.classes)[0] as
		| NimbleClassItem
		| undefined;
	const level = characterClass?.system?.classLevel ?? 1;
	const levelingTo = level + 1;

	let boons = getChoicesFromCompendium('boon');
	let subclasses: Array<{
		uuid: string;
		name: string;
		img: string;
		system: { parentClass: string };
	}> = $state([]);
	let hasSubclassSelection = levelingTo === 3;

	// Load subclasses filtered by parent class when leveling to 3
	$effect(() => {
		if (hasSubclassSelection && characterClass) {
			getSubclassChoices(characterClass.identifier).then((choices) => {
				subclasses = choices;
			});
		}
	});

	let chooseBoon = $state(false);
	let hitPointRollSelection = $state('roll');
	let selectedAbilityScores: string[] | string | null = $state(null);
	let selectedBoon = $state(null);
	let selectedSubclass = $state(null);
	let skillPointChanges = $state(generateBlankSkillSet());

	let hasStatIncrease = $state(false);
	let hasSkillPointsOverCap = $state(false);

	let skillPointChangesAssigned = $derived.by(() => {
		return Object.values(skillPointChanges).reduce((acc, change) => acc + (change ?? 0), 0) === 1;
	});

	let isComplete = $derived.by(() => {
		return (
			((Array.isArray(selectedAbilityScores)
				? selectedAbilityScores?.length === 2
				: selectedAbilityScores) ||
				!hasStatIncrease) &&
			skillPointChangesAssigned &&
			!hasSkillPointsOverCap &&
			(selectedSubclass || !hasSubclassSelection)
		);
	});
</script>

<section class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.75rem;">
	<HitPointSelection {document} bind:hitPointRollSelection />

	<AbilityScoreIncrease
		{boons}
		{characterClass}
		{document}
		{levelingTo}
		bind:chooseBoon
		bind:selectedAbilityScores
		bind:selectedBoon
		bind:hasStatIncrease
	/>

	<SkillPointAssignment
		{chooseBoon}
		{document}
		{selectedBoon}
		selectedAbilityScore={selectedAbilityScores}
		bind:skillPointChanges
		bind:selectedAbilityScores
		bind:hasSkillPointsOverCap
	/>

	{#if levelingTo === 3 && subclasses.length}
		<SubclassSelection {subclasses} bind:selectedSubclass />
	{/if}
</section>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		aria-label={!isComplete
			? hasSkillPointsOverCap
				? 'A skill would exceed the 12 point cap'
				: 'Complete all selections before submitting'
			: 'Submit'}
		data-tooltip={!isComplete
			? hasSkillPointsOverCap
				? 'One or more skills would exceed the 12 point cap. Please reallocate skill points before submitting.'
				: 'Complete all selections before submitting'
			: ''}
		onclick={submit}
		disabled={!isComplete}
	>
		Submit
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
