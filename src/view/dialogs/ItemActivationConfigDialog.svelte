<script>
	import { untrack } from 'svelte';
	import { getPools as getChargePools } from '#utils/chargePool/chargePoolSync.js';
	import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
	import localize from '#utils/localize.js';
	import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';
	import { getDieFaceIcon } from '../sheets/components/DicePoolTracker.svelte.ts';
	import RollModeConfig from './components/RollModeConfig.svelte';
	const { skillCheckDialog } = CONFIG.NIMBLE;

	let { actor, dialog, item, ...data } = $props();
	let selectedRollMode = $state(untrack(() => Math.clamp(data.rollMode ?? 0, -6, 6)));
	let situationalModifiers = $state('');
	let primaryDieValue = $state();
	let primaryDieModifier = $state();
	let shouldRollBeHidden = $state(!!game.settings.get('nimble', 'hideRolls'));

	// Selected rolled-pool dice to spend on this roll, keyed as `${poolId}:${faceIndex}`.
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

	// Charge pools with a die-size hint (roll-on-spend resources: Combat Dice,
	// Mana Dice). Each charge is a single die that rolls AS PART OF the damage
	// roll. Selection is a numeric count per pool, capped by `current`.
	let spendableChargePools = untrack(() =>
		getChargePools(actor)
			.filter((pool) => pool.dieSize != null && pool.current > 0)
			.map((pool) => ({
				id: pool.id,
				identifier: pool.identifier,
				label: pool.label,
				dieSize: pool.dieSize,
				current: pool.current,
				max: pool.max,
			})),
	);

	// Per-charge-pool count of charges the player has chosen to spend.
	let chargeSpendCounts = $state(Object.fromEntries(spendableChargePools.map((p) => [p.id, 0])));

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

	function adjustChargeSpend(poolId, delta) {
		const pool = spendableChargePools.find((p) => p.id === poolId);
		if (!pool) return;
		const next = Math.max(0, Math.min(pool.current, (chargeSpendCounts[poolId] ?? 0) + delta));
		chargeSpendCounts = { ...chargeSpendCounts, [poolId]: next };
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

	// Charge-pool spends produce dice expressions, not flat bonuses. Aggregate
	// per pool: "+2d6[Combat Dice]" rather than two separate "+1d6" terms.
	let chargeBonusFragments = $derived.by(() => {
		const fragments = [];
		for (const pool of spendableChargePools) {
			const count = chargeSpendCounts[pool.id] ?? 0;
			if (count < 1) continue;
			fragments.push({
				formula: `+${count}${pool.dieSize}[${pool.label}]`,
				display: `+${count}${pool.dieSize}`,
				label: pool.label,
			});
		}
		return fragments;
	});

	// Labeled formula fragment for the damage roll: "+3[Fury Dice]+4[Fury Dice]+2d6[Combat Dice]".
	// Foundry parses [label] into term.options.flavor so the roll tooltip on the
	// chat card credits each face / die to its source pool.
	let poolBonusFormula = $derived(
		poolBonusEntries.map((e) => `+${e.face}[${e.label}]`).join('') +
			chargeBonusFragments.map((f) => f.formula).join(''),
	);

	// Convenience flag for the UI: only render the spend section if anything is spendable.
	let hasSpendablePools = $derived(spendablePools.length > 0 || spendableChargePools.length > 0);

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

	{#if hasSpendablePools}
		<div class="nimble-roll-modifiers-container">
			<div class="nimble-roll-modifiers nimble-pool-spend">
				<h5 class="nimble-pool-spend__heading">
					{localize('NIMBLE.activationDialog.spendPoolDice')}
				</h5>

				{#each spendablePools as pool (pool.id)}
					<div class="nimble-pool-spend__row">
						<span class="nimble-pool-spend__label">
							<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
							{pool.label}
						</span>
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

				{#each spendableChargePools as pool (pool.id)}
					{@const selected = chargeSpendCounts[pool.id] ?? 0}
					<div class="nimble-pool-spend__row">
						<span class="nimble-pool-spend__label">
							<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
							{pool.label}
						</span>
						<div class="nimble-pool-spend__stepper">
							<button
								type="button"
								class="nimble-pool-spend__stepper-btn"
								aria-label={localize('NIMBLE.activationDialog.spendCharge.decrement')}
								disabled={selected <= 0}
								onclick={() => adjustChargeSpend(pool.id, -1)}
							>
								−
							</button>
							<span class="nimble-pool-spend__stepper-value">
								<strong>{selected}</strong>{pool.dieSize}
								<span class="nimble-pool-spend__stepper-available">
									/ {pool.current}
								</span>
							</span>
							<button
								type="button"
								class="nimble-pool-spend__stepper-btn"
								aria-label={localize('NIMBLE.activationDialog.spendCharge.increment')}
								disabled={selected >= pool.current}
								onclick={() => adjustChargeSpend(pool.id, 1)}
							>
								+
							</button>
						</div>
					</div>
				{/each}

				{#if poolBonus > 0 || chargeBonusFragments.length > 0}
					<div class="nimble-pool-spend__total">
						{#if poolBonus > 0}
							<span class="nimble-pool-spend__total-part">+{poolBonus}</span>
						{/if}
						{#each chargeBonusFragments as fragment, i (i)}
							<span class="nimble-pool-spend__total-part">
								{fragment.display}
								<span class="nimble-pool-spend__total-label">{fragment.label}</span>
							</span>
						{/each}
					</div>
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
			const consumedChargePools = Object.entries(chargeSpendCounts)
				.filter(([, count]) => count > 0)
				.map(([poolId, count]) => ({ poolId, count }));
			dialog.submitActivation({
				rollMode: selectedRollMode,
				rollFormula: modifiedFormulas[0]?.formula || '0',
				situationalModifiers,
				primaryDieValue: primaryDieValue,
				primaryDieModifier: primaryDieModifier,
				rollHidden: shouldRollBeHidden,
				consumedPoolDice,
				consumedChargePools,
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
		padding: 0.625rem 0.75rem;
		background: color-mix(
			in srgb,
			var(--nimble-sheet-background, hsl(220, 15%, 16%)) 92%,
			transparent
		);
		border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
		border-radius: 6px;

		&__heading {
			margin: 0;
			font-size: 0.8125rem;
			font-weight: 600;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			opacity: 0.75;
		}

		&__row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
			padding-block: 0.125rem;
			flex-wrap: nowrap;
		}

		&__label {
			display: inline-flex;
			align-items: center;
			gap: 0.4rem;
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--nimble-text-color-primary);

			i {
				font-size: 0.95rem;
				color: hsl(210, 65%, 56%);
			}
		}

		&__dice {
			display: inline-flex;
			gap: 0.3rem;
			flex-wrap: wrap;
			justify-content: flex-end;
		}

		&__die {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.75rem;
			height: 1.75rem;
			padding: 0 0.4rem;
			background: color-mix(in srgb, hsl(210, 65%, 46%) 12%, transparent);
			border: 2px solid hsl(210, 65%, 46%);
			border-radius: 4px;
			font-weight: 700;
			color: hsl(210, 70%, 70%);
			cursor: pointer;
			transition:
				background 0.12s ease,
				color 0.12s ease,
				transform 0.08s ease;

			&:hover {
				background: color-mix(in srgb, hsl(210, 65%, 46%) 22%, transparent);
			}

			&--selected {
				background: hsl(0, 60%, 50%);
				border-color: hsl(0, 60%, 38%);
				color: white;
				transform: scale(0.93);
			}
		}

		&__stepper {
			display: inline-flex;
			align-items: center;
			gap: 0.15rem;
		}

		&__stepper-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			background: color-mix(in srgb, hsl(210, 65%, 46%) 12%, transparent);
			border: 1px solid hsl(210, 65%, 46%);
			border-radius: 4px;
			font-size: 1rem;
			font-weight: 700;
			line-height: 1;
			color: hsl(210, 70%, 70%);
			cursor: pointer;
			transition: background 0.12s ease;

			&:hover:not(:disabled) {
				background: color-mix(in srgb, hsl(210, 65%, 46%) 22%, transparent);
			}

			&:disabled {
				opacity: 0.35;
				cursor: not-allowed;
			}
		}

		&__stepper-value {
			min-width: 2.75rem;
			padding-inline: 0.25rem;
			text-align: center;
			font-variant-numeric: tabular-nums;
			font-size: 0.875rem;

			strong {
				font-weight: 700;
				color: var(--nimble-text-color-primary);
			}
		}

		&__stepper-available {
			opacity: 0.55;
			font-size: 0.8em;
		}

		&__total {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 0.6rem;
			padding-top: 0.375rem;
			border-top: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
			font-size: 0.875rem;
			font-weight: 600;
			color: hsl(150, 55%, 60%);
		}

		&__total-part {
			display: inline-flex;
			align-items: baseline;
			gap: 0.25rem;
		}

		&__total-label {
			font-size: 0.75em;
			font-weight: 500;
			opacity: 0.75;
		}
	}
</style>
