<script lang="ts">
import generateBlankSkillSet from '../../utils/generateBlankSkillSet.js';
import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';

import AbilityScoreIncrease from './components/levelUpHelper/AbilityScoreIncrease.svelte';
import HitPointSelection from './components/levelUpHelper/HitPointSelection.svelte';
import SkillPointAssignment from './components/levelUpHelper/SkillPointAssignment.svelte';
import SubclassSelection from './components/levelUpHelper/SubclassSelection.svelte';

function submit() {
	dialog.submit({
		selectedAbilityScore,
		selectedSubclass,
		skillPointChanges,
		takeAverageHp: hitPointRollSelection === 'average',
	});
}

const { defaultSkillAbilities, skills } = CONFIG.NIMBLE;

let { document, dialog, ...data } = $props();

let boons = getChoicesFromCompendium('boon');
let subclasses = $state([]);

// Load subclass documents from compendium
Promise.all(getChoicesFromCompendium('subclass').map((uuid) => fromUuid(uuid)))
	.then((documents) => {
		subclasses = documents.filter((d) => d !== null && d.system.parentClass === (characterClass?.identifier || characterClass.name.toLocaleLowerCase()));
	});

let chooseBoon = $state(false);
let hitPointRollSelection = $state('roll');
let selectedAbilityScore = $state(null);
let selectedBoon = $state(null);
let selectedSubclass = $state(null);
let skillPointChanges = $state(generateBlankSkillSet());

const characterClass = Object.values(document.classes)?.[0];
const level = characterClass?.system?.classLevel;
const levelingTo = level + 1;

let hasStatIncrease = $state(false);

let hasSkillPointChanges = $derived.by(() => {
	return Object.values(skillPointChanges).reduce((acc, change) => acc + (change ?? 0), 0) > 0;
});

let isComplete = $derived.by(() => {
	return (selectedAbilityScore || !hasStatIncrease) && hasSkillPointChanges && (selectedSubclass || levelingTo !== 3);
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
        bind:selectedAbilityScore
        bind:selectedBoon
		bind:hasStatIncrease
    />

    <SkillPointAssignment
        {chooseBoon}
        {document}
        {selectedAbilityScore}
        bind:skillPointChanges
    />

    {#if levelingTo === 3 && subclasses.length}
        <SubclassSelection {subclasses} bind:selectedSubclass />
    {/if}
</section>

<footer class="nimble-sheet__footer">
    <button
        class="nimble-button"
        data-button-variant="basic"
		aria-label={!isComplete ? "Complete all selections before submitting" : "Submit"}
        data-tooltip={!isComplete ? "Complete all selections before submitting" : ""}
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
