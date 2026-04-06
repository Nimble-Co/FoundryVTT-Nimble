<script lang="ts">
	import type { NimbleBoonItem } from '../../documents/item/boon.js';
	import type { NimbleClassItem } from '../../documents/item/class.js';
	import type { NimbleFeatureItem } from '../../documents/item/feature.js';
	import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

	import generateBlankSkillSet from '../../utils/generateBlankSkillSet.js';
	import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';
	import getClassFeaturesFromIndex, {
		buildClassFeatureIndex,
	} from '../../utils/getClassFeatures.ts';
	import getEpicBoons from '../../utils/getEpicBoons.ts';
	import getSubclassChoices from '../../utils/getSubclassChoices.js';

	import AbilityScoreIncrease from './components/levelUpHelper/AbilityScoreIncrease.svelte';
	import EpicBoonSelection from './components/levelUpHelper/EpicBoonSelection.svelte';
	import HitPointSelection from './components/levelUpHelper/HitPointSelection.svelte';
	import LevelUpClassFeatureSelection from './components/levelUpHelper/LevelUpClassFeatureSelection.svelte';
	import SkillPointAssignment from './components/levelUpHelper/SkillPointAssignment.svelte';
	import SubclassSelection from './components/levelUpHelper/SubclassSelection.svelte';

	const { forms, levelUpDialog } = CONFIG.NIMBLE;

	function submit() {
		dialog.submit({
			selectedAbilityScore: selectedAbilityScores,
			selectedSubclass,
			selectedEpicBoon,
			skillPointChanges,
			takeAverageHp: hitPointRollSelection === 'average',
			classFeatures: classFeatures
				? {
						autoGrant: classFeatures.autoGrant,
						selected: selectedClassFeatures,
					}
				: null,
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

	// Epic boon state (level 19)
	let epicBoons: Array<{
		uuid: string;
		name: string;
		img: string;
		system: { boonType: string; description: string };
	}> = $state([]);
	let hasEpicBoonSelection = $derived(levelingTo === 19);

	// Load subclasses filtered by parent class when leveling to 3
	$effect(() => {
		if (hasSubclassSelection && characterClass) {
			getSubclassChoices(characterClass.identifier).then((choices) => {
				subclasses = choices;
			});
		}
	});

	// Load epic boons when leveling to 19
	$effect(() => {
		if (hasEpicBoonSelection) {
			getEpicBoons().then((choices) => {
				epicBoons = choices;
			});
		}
	});

	let chooseBoon = $state(false);
	let hitPointRollSelection = $state('roll');
	let selectedAbilityScores: string[] | string | null = $state(null);
	let lastSelectedAbilityScores: string[] | string | null = $state(null);
	let selectedBoon = $state(null);
	let selectedSubclass = $state(null);
	let selectedEpicBoon: NimbleBoonItem | null = $state(null);
	let skillPointChanges = $state(generateBlankSkillSet());

	let hasStatIncrease = $state(false);
	let skillPointsOverMax = $state(false);

	// Class features state
	let classFeatures: ClassFeatureResult | null = $state(null);
	let selectedClassFeatures: Map<string, NimbleFeatureItem> = $state(new Map());
	let featuresLoading = $state(true);

	// Load class features when dialog opens
	$effect(() => {
		if (!characterClass) return;

		featuresLoading = true;
		buildClassFeatureIndex().then(async (index) => {
			const rawFeatures = await getClassFeaturesFromIndex(
				index,
				characterClass.identifier,
				levelingTo,
			);

			// Get UUIDs of features the character already has (via compendiumSource)
			const ownedFeatureUuids = new Set(
				(document.items ?? [])
					.filter((item) => item.type === 'feature')
					.map(
						(item) =>
							(item as unknown as { _stats?: { compendiumSource?: string } })._stats
								?.compendiumSource,
					)
					.filter((uuid): uuid is string => !!uuid),
			);

			// Filter out already-owned features from autoGrant
			const filteredAutoGrant = rawFeatures.autoGrant.filter(
				(feature) => !ownedFeatureUuids.has(feature.uuid),
			);

			// Filter out already-owned features from selection groups
			const filteredSelectionGroups = new Map<string, NimbleFeatureItem[]>();
			for (const [groupName, features] of rawFeatures.selectionGroups) {
				const filteredFeatures = features.filter((feature) => !ownedFeatureUuids.has(feature.uuid));
				// Only include groups that still have options
				if (filteredFeatures.length > 0) {
					filteredSelectionGroups.set(groupName, filteredFeatures);
				}
			}

			classFeatures = {
				autoGrant: filteredAutoGrant,
				selectionGroups: filteredSelectionGroups,
			};
			featuresLoading = false;
		});
	});

	const classFeaturesComplete = $derived.by(() => {
		if (featuresLoading) return false;
		if (!classFeatures) return true;

		// Check if all selection groups have a selection
		for (const groupName of classFeatures.selectionGroups.keys()) {
			if (!selectedClassFeatures.has(groupName)) {
				return false;
			}
		}
		return true;
	});

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
			(selectedSubclass || !hasSubclassSelection) &&
			(selectedEpicBoon || !hasEpicBoonSelection) &&
			classFeaturesComplete
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

	{#if levelingTo === 19 && epicBoons.length}
		<EpicBoonSelection {epicBoons} bind:selectedEpicBoon />
	{/if}

	<LevelUpClassFeatureSelection
		{classFeatures}
		bind:selectedFeatures={selectedClassFeatures}
		loading={featuresLoading}
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
