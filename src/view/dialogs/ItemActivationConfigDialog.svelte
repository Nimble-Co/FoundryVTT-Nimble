<script>
import RollModeConfig from './components/RollModeConfig.svelte';

import getRollFormula from '../../utils/getRollFormula.js';

let { actor, dialog, item, ...data } = $props();
let selectedRollMode = $state(Math.clamp(data.rollMode ?? 0, -6, 6));
let situational_modifiers = $state("");

// Get the damage formula from the item's activation effects
let damageFormula = $state(() => {
	const effects = item.system.activation?.effects ?? [];
	const damageEffect = effects.find(e => e.type === 'damage');
	return damageEffect?.formula || '0';
});

// Modify the formula by adding the situational_modifiers
let modifiedFormula = $derived(() => {
	let formula = damageFormula();
	if (situational_modifiers !== "") {
		formula += "+" + situational_modifiers;
	}
	return formula;
});

let rollFormula = $derived(
	getRollFormula(actor, {
		...data,
		rollMode: selectedRollMode,
		formula: modifiedFormula(),
	}),
);
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
    <RollModeConfig bind:selectedRollMode />

    <div class="nimble-roll-modifiers">
        <label>
            situational modifiers:
            <input type="string" bind:value={situational_modifiers} placeholder="0" />
        </label>
    </div>

    <div class="nimble-roll-formula">{rollFormula}</div>
</article>

<footer class="nimble-sheet__footer">
    <button
        class="nimble-button"
        data-button-variant="basic"
        onclick={() => {
			if (situational_modifiers !== "") {
				const isValid = Roll.validate(situational_modifiers);

				if (!isValid) {
					ui.notifications?.warn("❌ Invalid dice formula in the situational modifiers!");
					return;
				}
			}
			dialog.submit({
				rollMode: selectedRollMode,
				rollFormula: modifiedFormula(),
				situational_modifiers
			});
			}}
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

    .nimble-roll-modifiers {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1rem;

        label {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;

            input {
                padding: 0.5rem;
                border: 1px solid var(--nimble-border-color);
                border-radius: var(--nimble-border-radius);
            }
        }
    }
</style>
