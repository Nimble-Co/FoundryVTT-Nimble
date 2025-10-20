<script>
import RollModeConfig from './components/RollModeConfig.svelte';

import getRollFormula from '../../utils/getRollFormula.js';

let { actor, dialog, item, ...data } = $props();
let selectedRollMode = $state(Math.clamp(data.rollMode ?? 0, -6, 6));

// Get the damage formula from the item's activation effects
let damageFormula = $derived(() => {
	const effects = item.system.activation?.effects ?? [];
	const damageEffect = effects.find(e => e.type === 'damage');
	return damageEffect?.formula || '0';
});


let rollFormula = $derived(
	getRollFormula(actor, {
		...data,
		rollMode: selectedRollMode,
		formula: damageFormula,
	}),
);
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
    <RollModeConfig bind:selectedRollMode />

    <div class="nimble-roll-formula">{rollFormula}</div>
</article>

<footer class="nimble-sheet__footer">
    <button
        class="nimble-button"
        data-button-variant="basic"
        onclick={() => dialog.submit({ rollMode: selectedRollMode })}
    >
        <i class="nimble-button__icon fa-solid fa-dice-d20"></i>
        Roll
    </button>
</footer>

<style lang="scss">
    [data-button-variant="basic"] {
        --nimble-button-padding: 0.5rem;
        --nimble-button-width: 100%
    }


</style>
