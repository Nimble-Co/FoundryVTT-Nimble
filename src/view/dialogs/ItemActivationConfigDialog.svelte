<script>
import RollModeConfig from './components/RollModeConfig.svelte';

import getRollFormula from '../../utils/getRollFormula.js';

let { actor, dialog, item, ...data } = $props();
let selectedRollMode = $state(Math.clamp(data.rollMode ?? 0, -6, 6));
let situational_modifiers = $state("");
let primary_die_value = $state();

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
	const roll = new Roll(formula);
	const terms = roll.terms;

	// Find the first Die term
	const firstDieIndex = terms.findIndex(t => t instanceof Die);
	if (primary_die_value !==terms[firstDieIndex].faces) {
		if (firstDieIndex !== -1) {
			const die = terms[firstDieIndex];

			if (die.number > 1) {
				// Reduce the number of dice by one
				die.number -= 1;
			} else {
				// Remove this die completely
				terms.splice(firstDieIndex, 1);
				// Also remove a "+" or "-" right after if needed
				if (terms[firstDieIndex] instanceof OperatorTerm) terms.splice(firstDieIndex, 1);
			}
		}
		// Build the new formula: primary_die_value value first
		formula = primary_die_value !== 0
		? `${primary_die_value} + ${terms.map(t => t.formula).join(" ")}`
		: terms.map(t => t.formula).join(" ");
	} else {
		formula = primary_die_value + "+" + formula;
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

	<div class="nimble-roll-modifiers">
        <label>
            set primary die:
            <input type="number" bind:value={primary_die_value} placeholder="0" />
        </label>
    </div>

    <div class="nimble-roll-formula">{rollFormula}</div>
</article>

<footer class="nimble-sheet__footer">
    <button
        class="nimble-button"
        data-button-variant="basic"
        onclick={() => {
			if(situational_modifiers !== ""){
				const isValid = Roll.validate(situational_modifiers);
				if (!isValid) {
					ui.notifications?.warn("❌ Invalid dice formula in the situational modifiers!");
					return;
				}
			}
			if(primary_die_value !== null) {
				const roll = new Roll(damageFormula());
				const terms = roll.terms;
				const firstDieIndex = terms.findIndex(t => t instanceof Die);
				if (primary_die_value > terms[firstDieIndex].faces || primary_die_value < 0){
					ui.notifications?.warn("❌ Invalid value for primary die!");
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
