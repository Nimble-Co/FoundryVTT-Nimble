<script>
import generateBlankSkillSet from '../../utils/generateBlankSkillSet.js';
import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';
import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

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
let subclasses = getChoicesFromCompendium('subclass');

let chooseBoon = $state(false);
let hitPointRollSelection = $state('roll');
let selectedAbilityScore = $state(null);
let selectedBoon = $state(null);
let selectedSubclass = $state(null);
let skillPointChanges = $state(generateBlankSkillSet());

const characterClass = Object.values(document.classes)?.[0];
const level = characterClass?.system?.classLevel;
const levelingTo = level + 1;
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
        onclick={submit}
    >
        Submit
    </button>
</footer>

<style lang="scss">
    .nimble-sheet__footer {
        --nimble-button-padding: 0.5rem 1rem;
        --nimble-button-width: 100%;
    }
</style>
