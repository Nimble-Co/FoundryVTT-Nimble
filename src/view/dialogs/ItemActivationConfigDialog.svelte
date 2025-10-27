<script>
import RollModeConfig from './components/RollModeConfig.svelte';

import getRollFormula from '../../utils/getRollFormula.js';

let { actor, dialog, item, ...data } = $props();
let selectedRollMode = $state(Math.clamp(data.rollMode ?? 0, -6, 6));
let situationalModifiers = $state("");
let primaryDieValue = $state();
let primaryDieModifier = $state();

// Get the damage formula from the item's activation effects
let damageFormula = $state(() => {
	const effects = item.system.activation?.effects ?? [];
	const damageEffect = effects.find(e => e.type === 'damage');
	return damageEffect?.formula || '0';
});

// Modify the formula by adding the situationalModifiers
let modifiedFormula = $derived(() => {
	let formula = damageFormula();
	if (situationalModifiers !== "") {
		formula += "+" + situationalModifiers;
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

    <div class="nimble-roll-modifiers-container">
        <div class="nimble-roll-modifiers">
            <label>
                situational modifiers:
                <input type="string" bind:value={situationalModifiers} placeholder="0" />
            </label>
        </div>
	</div>
	<div class="nimble-roll-modifiers-container">
        <div class="nimble-roll-modifiers">
            <label>
                set primary die:
                <input type="number" bind:value={primaryDieValue} placeholder="0" />
            </label>
        </div>

		<div class="nimble-roll-modifiers">
            <label>
                primary die modifier:
                <input type="number" bind:value={primaryDieModifier} placeholder="0" disabled={primaryDieValue !== undefined}/>
            </label>
        </div>
    </div>

    <div class="nimble-roll-formula">{Roll.replaceFormulaData(modifiedFormula(), actor.getRollData(item))}</div>
</article>

<footer class="nimble-sheet__footer">
    <button
        class="nimble-button"
        data-button-variant="basic"
        onclick={() => {
			if(situationalModifiers !== ""){
				const isValid = Roll.validate(situationalModifiers);
				if (!isValid) {
					ui.notifications?.warn("❌ Invalid dice formula in the situational modifiers!");
					return;
				}
			}
			if(primaryDieValue != null) {
				const roll = new Roll(damageFormula());
				const terms = roll.terms;
				const firstDieIndex = terms.findIndex(t => t instanceof foundry.dice.terms.Die);
				if (primaryDieValue > terms[firstDieIndex].faces || primaryDieValue < 0){
					ui.notifications?.warn("❌ Invalid value for primary die!");
					return;
				}
			}
			dialog.submit({
				rollMode: selectedRollMode,
				rollFormula: modifiedFormula(),
				situationalModifiers,
				primaryDieValue: primaryDieValue,
				primaryDieModifier: primaryDieModifier,
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

    .nimble-roll-modifiers-container {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
    }

    .nimble-roll-modifiers {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;

        label {
            display: flex;
            align-items: center;
            gap: 0.5rem;

            input {
                padding: 0.5rem;
                border: 1px solid var(--nimble-border-color);
                border-radius: var(--nimble-border-radius);
				flex: 1;
            }
        }
    }
</style>
