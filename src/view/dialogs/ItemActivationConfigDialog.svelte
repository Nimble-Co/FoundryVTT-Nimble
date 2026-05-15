<script>
	import { untrack } from 'svelte';
	import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
	import localize from '#utils/localize.js';
	import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';
	import RollModeConfig from './components/RollModeConfig.svelte';
	const { skillCheckDialog } = CONFIG.NIMBLE;

	let { actor, dialog, item, ...data } = $props();
	let selectedRollMode = $state(untrack(() => Math.clamp(data.rollMode ?? 0, -6, 6)));
	let situationalModifiers = $state('');
	let primaryDieValue = $state();
	let primaryDieModifier = $state();
	let shouldRollBeHidden = $state(!!game.settings.get('nimble', 'hideRolls'));

	// Selected pool dice to spend on this roll, keyed as `${poolId}:${faceIndex}`.
	let selectedDieKeys = $state(new Set());

	// Snapshot the actor's rolled pools at dialog-open time so the UI is stable
	// even if pool state changes mid-dialog.
	let spendablePools = untrack(() =>
		getDicePools(actor)
			.filter((pool) => pool.faces.length > 0)
			.map((pool) => ({
				id: pool.id,
				identifier: pool.identifier,
				label: pool.label,
				dieSize: pool.dieSize,
				faces: [...pool.faces],
			})),
	);

	function toggleDie(poolId, faceIndex) {
		const key = `${poolId}:${faceIndex}`;
		if (selectedDieKeys.has(key)) {
			selectedDieKeys.delete(key);
		} else {
			selectedDieKeys.add(key);
		}
		selectedDieKeys = new Set(selectedDieKeys);
	}

	function isDieSelected(poolId, faceIndex) {
		return selectedDieKeys.has(`${poolId}:${faceIndex}`);
	}

	let poolBonusEntries = $derived.by(() => {
		const entries = [];
		for (const key of selectedDieKeys) {
			const [poolId, indexStr] = key.split(':');
			const pool = spendablePools.find((p) => p.id === poolId);
			if (!pool) continue;
			const face = pool.faces[Number(indexStr)];
			if (typeof face !== 'number') continue;
			entries.push({ face, label: pool.label });
		}
		return entries;
	});

	let poolBonus = $derived(poolBonusEntries.reduce((sum, e) => sum + e.face, 0));

	// Labeled formula fragment for the damage roll: "+3[Fury Dice]+4[Fury Dice]".
	// Foundry parses [label] into term.options.flavor so the roll tooltip on the
	// chat card credits each face to its source pool.
	let poolBonusFormula = $derived(poolBonusEntries.map((e) => `+${e.face}[${e.label}]`).join(''));

	const { damageTypes, hitDice } = CONFIG.NIMBLE;

	// Get all damage effects from the item's activation effects
	// This searches recursively through the effects tree, including sharedRolls
	// Only include top-level damage effects (not nested ones like criticalHit, miss, etc.)
	let damageEffects = $derived.by(() => {
		const effects = item.system.activation?.effects ?? [];
		const allDamageEffects = [];

		// Flatten the tree to get all effects including those in sharedRolls
		const flattened = flattenEffectsTree(effects);
		for (const effect of flattened) {
			// Only include top-level damage effects or sharedRolls
			// Exclude conditional damage (criticalHit, miss, hit, failedSaveBy, etc.)
			const isConditional =
				(effect.parentContext && ['criticalHit', 'miss', 'hit'].includes(effect.parentContext)) ||
				effect.parentContext?.startsWith('failedSaveBy');

			if (effect.type === 'damage' && !isConditional) {
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

	// Modify formulas by adding the situationalModifiers and selected pool dice.
	// Pool dice are appended as a flat bonus to the FIRST damage roll only —
	// matches "Add a Fury Die to every STR attack" (one attack = one damage roll).
	let modifiedFormulas = $derived.by(() => {
		return damageEffects.map((effect, index) => {
			let formula = effect.formula;
			if (situationalModifiers !== '') {
				formula += `+${situationalModifiers}`;
			}
			if (index === 0 && poolBonusFormula) {
				formula += poolBonusFormula;
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

	{#if spendablePools.length > 0}
		<div class="nimble-roll-modifiers-container">
			<div class="nimble-roll-modifiers nimble-pool-spend">
				<h5 class="nimble-pool-spend__heading">
					{localize('NIMBLE.activationDialog.spendPoolDice')}
				</h5>
				{#each spendablePools as pool (pool.id)}
					<div class="nimble-pool-spend__row">
						<span class="nimble-pool-spend__label">{pool.label}</span>
						<div class="nimble-pool-spend__dice">
							{#each pool.faces as face, faceIndex (faceIndex)}
								<button
									type="button"
									class="nimble-pool-spend__die"
									class:nimble-pool-spend__die--selected={isDieSelected(pool.id, faceIndex)}
									aria-pressed={isDieSelected(pool.id, faceIndex)}
									onclick={() => toggleDie(pool.id, faceIndex)}
								>
									{face}
								</button>
							{/each}
						</div>
					</div>
				{/each}
				{#if poolBonus > 0}
					<span class="nimble-pool-spend__total">
						{localize('NIMBLE.activationDialog.spendPoolBonus', { bonus: poolBonus })}
					</span>
				{/if}
			</div>
		</div>
	{/if}

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
	{#if game.user?.isGM}
		<div class="nimble-roll-modifiers-container">
			<label>
				{skillCheckDialog.hideRoll}
				<input type="checkbox" bind:checked={shouldRollBeHidden} class="modifier-item__checkbox" />
			</label>
		</div>
	{/if}
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
			const consumedPoolDice = [...selectedDieKeys].map((key) => {
				const [poolId, indexStr] = key.split(':');
				return { poolId, faceIndex: Number(indexStr) };
			});
			dialog.submitActivation({
				rollMode: selectedRollMode,
				rollFormula: modifiedFormulas[0]?.formula || '0',
				situationalModifiers,
				primaryDieValue: primaryDieValue,
				primaryDieModifier: primaryDieModifier,
				rollHidden: shouldRollBeHidden,
				consumedPoolDice,
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

	.nimble-pool-spend {
		gap: 0.5rem;

		&__heading {
			margin: 0;
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--nimble-text-color-primary);
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex-wrap: wrap;
		}

		&__label {
			min-width: 6rem;
			font-size: 0.875rem;
			font-weight: 500;
		}

		&__dice {
			display: inline-flex;
			gap: 0.25rem;
		}

		&__die {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.75rem;
			min-height: 1.75rem;
			padding: 0 0.4rem;
			background: var(--nimble-background-color-secondary, hsl(210, 65%, 92%));
			border: 2px solid hsl(210, 65%, 46%);
			border-radius: 4px;
			font-weight: 700;
			color: hsl(210, 65%, 30%);
			cursor: pointer;
			transition:
				background 0.15s ease,
				transform 0.1s ease;

			&:hover {
				background: hsl(210, 75%, 85%);
			}

			&--selected {
				background: hsl(0, 65%, 58%);
				border-color: hsl(0, 65%, 35%);
				color: white;
				transform: scale(0.95);
			}
		}

		&__total {
			font-size: 0.875rem;
			font-weight: 600;
			color: hsl(150, 50%, 35%);
		}
	}
</style>
