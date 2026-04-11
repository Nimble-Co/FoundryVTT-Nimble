<script lang="ts">
	import type { NimbleClassItem } from '../../documents/item/class.js';
	import type { NimbleFeatureItem } from '../../documents/item/feature.js';
	import generateBlankSkillSet from '../../utils/generateBlankSkillSet.js';
	import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';
	import getSubclassFeatures from '../../utils/getSubclassFeatures.js';

	import getSubclassChoices from '../../utils/getSubclassChoices.js';

	import AbilityScoreIncrease from './components/levelUpHelper/AbilityScoreIncrease.svelte';
	import HitPointSelection from './components/levelUpHelper/HitPointSelection.svelte';
	import SkillPointAssignment from './components/levelUpHelper/SkillPointAssignment.svelte';
	import SubclassFeatureDisplay from './components/levelUpHelper/SubclassFeatureDisplay.svelte';
	import SubclassSelection from './components/levelUpHelper/SubclassSelection.svelte';

	const { forms, levelUpDialog } = CONFIG.NIMBLE;

	function submit() {
		dialog.submit({
			selectedAbilityScore: selectedAbilityScores,
			selectedSubclass,
			skillPointChanges,
			takeAverageHp: hitPointRollSelection === 'average',
			grantedFeatures: subclassFeatures,
		});
	}

	function getSubmitButtonTooltip() {
		if (!isComplete) {
			if (skillPointsOverMax) {
				return levelUpDialog.skillPointsOverMax;
			} else {
				return levelUpDialog.completeAllSelections;
			}
		}

		return '';
	}

	function getSubmitButtonAriaLabel() {
		if (!isComplete) {
			if (skillPointsOverMax) {
				return levelUpDialog.skillPointsOverMaxTooltip;
			} else {
				return levelUpDialog.completeAllSelectionsTooltip;
			}
		}

		return forms.submit;
	}

	let { document, dialog } = $props();

	const characterClass: NimbleClassItem | undefined = $derived(
		document?.classes
			? (Object.values(document.classes)[0] as NimbleClassItem | undefined)
			: undefined,
	);
	const level = $derived(characterClass?.system?.classLevel ?? 1);
	const levelingTo = $derived(level + 1);

	let boons = getChoicesFromCompendium('boon');
	let subclasses: Array<{
		uuid: string;
		name: string;
		img: string;
		system: { parentClass: string };
	}> = $state([]);
	let hasSubclassSelection = $derived(levelingTo === 3);

	// Load subclasses filtered by parent class when leveling to 3
	$effect(() => {
		if (hasSubclassSelection && characterClass) {
			getSubclassChoices(characterClass.identifier).then((choices) => {
				subclasses = choices;
			});
		}
	});

	let subclassFeatures: NimbleFeatureItem[] = $state([]);

	// Fetch subclass features at level 3 reactively when a subclass is selected
	$effect(() => {
		if (hasSubclassSelection && selectedSubclass && characterClass) {
			const subclassIdentifier = (selectedSubclass as { name: string }).name.slugify({
				strict: true,
			});
			getSubclassFeatures(characterClass.identifier, subclassIdentifier, [1, 2, 3]).then(
				(features) => {
					subclassFeatures = features;
				},
			);
		} else if (hasSubclassSelection && !selectedSubclass) {
			subclassFeatures = [];
		}
	});

	// Fetch subclass features for levels after 3 from the character's existing subclass
	$effect(() => {
		if (!hasSubclassSelection && characterClass) {
			const existingSubclass = document.items?.find((i: { type: string }) => i.type === 'subclass');
			if (existingSubclass) {
				const subclassIdentifier = existingSubclass.name.slugify({ strict: true });
				getSubclassFeatures(characterClass.identifier, subclassIdentifier, [levelingTo]).then(
					(features) => {
						subclassFeatures = features;
					},
				);
			}
		}
	});

	let chooseBoon = $state(false);
	let hitPointRollSelection = $state('roll');
	let selectedAbilityScores: string[] | string | null = $state(null);
	let lastSelectedAbilityScores: string[] | string | null = $state(null);
	let selectedBoon = $state(null);
	let selectedSubclass = $state(null);
	let skillPointChanges = $state(generateBlankSkillSet());

	let hasStatIncrease = $state(false);
	let skillPointsOverMax = $state(false);

	let skillPointChangesAssigned = $derived.by(() => {
		return Object.values(skillPointChanges).reduce((acc, change) => acc + (change ?? 0), 0) === 1;
	});

	$effect(() => {
		if (!lastSelectedAbilityScores) {
			lastSelectedAbilityScores = selectedAbilityScores;
			return;
		}

		// check if values are different
		let hasChangedAbilityScore = Array.isArray(selectedAbilityScores)
			? JSON.stringify(lastSelectedAbilityScores) !== JSON.stringify(selectedAbilityScores)
			: lastSelectedAbilityScores !== selectedAbilityScores;

		if (hasChangedAbilityScore) {
			skillPointChanges = generateBlankSkillSet();
			lastSelectedAbilityScores = selectedAbilityScores;
		}
	});

	let isComplete = $derived.by(() => {
		const overMax = skillPointsOverMax;

		const abilityScoreComplete =
			(Array.isArray(selectedAbilityScores)
				? selectedAbilityScores?.length === 2
				: selectedAbilityScores) || !hasStatIncrease;

		return (
			abilityScoreComplete &&
			skillPointChangesAssigned &&
			!overMax &&
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
		bind:skillPointsOverMax
	/>

	{#if levelingTo === 3 && subclasses.length}
		<SubclassSelection {subclasses} bind:selectedSubclass />
	{/if}

	{#if subclassFeatures.length > 0}
		<SubclassFeatureDisplay features={subclassFeatures} />
	{/if}
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
