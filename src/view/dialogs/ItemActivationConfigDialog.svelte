<script>
	import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';
	import RollModeConfig from './components/RollModeConfig.svelte';

	let { actor, dialog, item, ...data } = $props();
	let selectedRollMode = $state(Math.clamp(data.rollMode ?? 0, -6, 6));
	let situationalModifiers = $state('');
	let primaryDieValue = $state();
	let primaryDieModifier = $state();

	const { damageTypes, hitDice } = CONFIG.NIMBLE;

	// Get all damage effects from the item's activation effects
	// This searches recursively through the effects tree, including sharedRolls
	let damageEffects = $derived.by(() => {
		const effects = item.system.activation?.effects ?? [];
		const allDamageEffects = [];

		// Flatten the tree to get all effects including those in sharedRolls
		const flattened = flattenEffectsTree(effects);
		for (const effect of flattened) {
			if (effect.type === 'damage') {
				allDamageEffects.push({
					formula: effect.formula || '0',
					damageType: effect.damageType,
				});
			}
		}

		// Also check sharedRolls directly (before flattening removes them)
		// This ensures we catch all damage effects in sharedRolls
		for (const effect of effects) {
			if (effect.type === 'savingThrow' && effect.sharedRolls) {
				for (const sharedRoll of effect.sharedRolls) {
					if (sharedRoll.type === 'damage') {
						// Check if we already have this damage effect
						const exists = allDamageEffects.some(
							(d) => d.formula === sharedRoll.formula && d.damageType === sharedRoll.damageType,
						);
						if (!exists) {
							allDamageEffects.push({
								formula: sharedRoll.formula || '0',
								damageType: sharedRoll.damageType,
							});
						}
					}
				}
			}
		}

		// If still no damage effects found, return a default one
		if (allDamageEffects.length === 0) {
			return [{ formula: '0' }];
		}

		return allDamageEffects;
	});

	// Get the first damage formula for backward compatibility (used in validation)
	let damageFormula = $derived(damageEffects[0]?.formula || '0');

	// Modify formulas by adding the situationalModifiers
	let modifiedFormulas = $derived.by(() => {
		return damageEffects.map((effect) => {
			let formula = effect.formula;
			if (situationalModifiers !== '') {
				formula += `+${situationalModifiers}`;
			}
			return {
				formula,
				damageType: effect.damageType,
			};
		});
	});
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
	<RollModeConfig bind:selectedRollMode />

	<div class="nimble-roll-modifiers-container">
		<div class="nimble-roll-modifiers">
			<label>
				{hitDice.situationalModifiers}:
				<input type="string" bind:value={situationalModifiers} placeholder="0" />
			</label>
		</div>
	</div>
	<div class="nimble-roll-modifiers-container">
		<div class="nimble-roll-modifiers">
			<label>
				{hitDice.setPrimaryDie}:
				<input type="number" bind:value={primaryDieValue} placeholder="0" />
			</label>
		</div>

		<div class="nimble-roll-modifiers">
			<label>
				{hitDice.setPrimaryDieModifier}:
				<input type="number" bind:value={primaryDieModifier} placeholder="0" />
			</label>
		</div>
	</div>

	<div class="nimble-roll-formulas">
		{#each modifiedFormulas as damageEffect}
			<div class="nimble-roll-formula">
				{#if damageEffect.damageType}
					<span class="nimble-roll-formula__type">
						{game.i18n.localize(damageTypes[damageEffect.damageType] || damageEffect.damageType)}:
					</span>
				{/if}
				<span class="nimble-roll-formula__formula">
					{Roll.replaceFormulaData(damageEffect.formula, actor.getRollData(item))}
				</span>
			</div>
		{/each}
	</div>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		onclick={() => {
			if (situationalModifiers !== '') {
				const isValid = Roll.validate(situationalModifiers);
				if (!isValid) {
					ui.notifications?.warn('❌ Invalid dice formula in the situational modifiers!');
					return;
				}
			}
			if (primaryDieValue != null) {
				const roll = new Roll(damageFormula);
				const terms = roll.terms;
				const firstDieIndex = terms.findIndex((t) => t instanceof foundry.dice.terms.Die);
				if (primaryDieValue > terms[firstDieIndex].faces || primaryDieValue < 0) {
					ui.notifications?.warn('❌ Invalid value for primary die!');
					return;
				}
			}
			dialog.submitActivation({
				rollMode: selectedRollMode,
				rollFormula: modifiedFormulas[0]?.formula || '0',
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
	[data-button-variant='basic'] {
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
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

	.nimble-roll-formulas {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.nimble-roll-formula {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--nimble-background-color-secondary);
		border-radius: 9999px;
		white-space: nowrap;

		&__type {
			font-weight: 600;
			color: var(--nimble-text-color-primary);
		}

		&__formula {
			font-family: var(--nimble-font-family-mono);
			color: var(--nimble-text-color-secondary);
		}
	}
</style>
