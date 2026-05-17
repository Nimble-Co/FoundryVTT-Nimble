<script lang="ts">
	import { untrack } from 'svelte';
	import type { ItemActivationConfigDialogProps } from '#types/components/ItemActivationConfigDialog.d.ts';
	import { getDieFaceIcon } from '#utils/dicePool/dieFaceIcons.js';
	import localize from '#utils/localize.js';
	import { createItemActivationConfigDialogState } from './itemActivationConfigDialogState.svelte.ts';
	import RollModeConfig from './components/RollModeConfig.svelte';

	const { skillCheckDialog, damageTypes, hitDice } = CONFIG.NIMBLE;

	let { actor, dialog, item, rollMode }: ItemActivationConfigDialogProps = $props();

	const state = createItemActivationConfigDialogState(
		untrack(() => ({
			actor,
			item,
			initialRollMode: rollMode,
			hideRollsDefault: !!game.settings.get('nimble', 'hideRolls'),
		})),
	);

	function onSubmit() {
		if (state.situationalModifiers !== '') {
			const isValid = Roll.validate(state.situationalModifiers);
			if (!isValid) {
				ui.notifications?.warn('❌ Invalid dice formula in the situational modifiers!');
				return;
			}
		}
		if (state.primaryDieValue != null) {
			const roll = new Roll(state.damageFormula);
			const terms = roll.terms;
			const firstDieIndex = terms.findIndex((t) => t instanceof foundry.dice.terms.Die);
			const firstDie = terms[firstDieIndex] as { faces?: number } | undefined;
			if (!firstDie?.faces || state.primaryDieValue > firstDie.faces || state.primaryDieValue < 0) {
				ui.notifications?.warn('❌ Invalid value for primary die!');
				return;
			}
		}
		const consumedPoolDice = [...state.selectedDieKeys].map((key) => {
			const [poolId, indexStr] = key.split(':');
			return { poolId, faceIndex: Number(indexStr) };
		});
		const consumedChargePools = Object.entries(state.chargeSpendCounts)
			.filter(([, count]) => count > 0)
			.map(([poolId, count]) => ({ poolId, count }));
		dialog.submitActivation({
			rollMode: state.selectedRollMode,
			rollFormula: state.modifiedFormulas[0]?.formula || '0',
			situationalModifiers: state.situationalModifiers,
			primaryDieValue: state.primaryDieValue,
			primaryDieModifier: state.primaryDieModifier,
			rollHidden: state.shouldRollBeHidden,
			consumedPoolDice,
			consumedChargePools,
		});
	}
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
	<RollModeConfig bind:selectedRollMode={state.selectedRollMode} />

	<div class="nimble-roll-modifiers-container">
		<div class="nimble-roll-modifiers">
			<label>
				{hitDice.situationalModifiers}:
				<input type="string" bind:value={state.situationalModifiers} placeholder="0" />
			</label>
		</div>
	</div>
	<div class="nimble-roll-modifiers-container">
		<div class="nimble-roll-modifiers">
			<label>
				{hitDice.setPrimaryDie}:
				<input type="number" bind:value={state.primaryDieValue} placeholder="0" />
			</label>
		</div>

		<div class="nimble-roll-modifiers">
			<label>
				{hitDice.setPrimaryDieModifier}:
				<input type="number" bind:value={state.primaryDieModifier} placeholder="0" />
			</label>
		</div>
	</div>

	{#if state.hasSpendablePools}
		<div class="nimble-roll-modifiers-container">
			<div class="nimble-roll-modifiers nimble-pool-spend">
				<h5 class="nimble-pool-spend__heading">
					{localize('NIMBLE.activationDialog.spendPoolDice')}
				</h5>

				{#each state.autoBonusSummaries as summary (summary.id)}
					<div class="nimble-pool-spend__row nimble-pool-spend__row--auto">
						<span class="nimble-pool-spend__label">
							<i class="fa-solid fa-bolt"></i>
							{summary.label}
						</span>
						<div class="nimble-pool-spend__auto">
							<span class="nimble-pool-spend__auto-faces">
								{#each summary.faces as face, i (i)}
									<span class="nimble-pool-spend__auto-face">{face}</span>
								{/each}
							</span>
							<span class="nimble-pool-spend__auto-total">+{summary.total}</span>
						</div>
					</div>
				{/each}

				{#each state.spendablePools as pool (pool.id)}
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
									class:nimble-pool-spend__die--selected={state.isDieSelected(pool.id, faceIndex)}
									aria-pressed={state.isDieSelected(pool.id, faceIndex)}
									onclick={() => state.toggleDie(pool.id, faceIndex)}
								>
									{face}
								</button>
							{/each}
						</div>
					</div>
				{/each}

				{#each state.spendableChargePools as pool (pool.id)}
					{@const selected = state.chargeSpendCounts[pool.id] ?? 0}
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
								onclick={() => state.adjustChargeSpend(pool.id, -1)}
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
								onclick={() => state.adjustChargeSpend(pool.id, 1)}
							>
								+
							</button>
						</div>
					</div>
				{/each}

				{#if state.poolBonus > 0 || state.chargeBonusFragments.length > 0 || state.autoBonusSummaries.length > 0}
					<div class="nimble-pool-spend__total">
						{#each state.autoBonusSummaries as summary (summary.id)}
							{#if summary.total > 0}
								<span class="nimble-pool-spend__total-part">
									+{summary.total}
									<span class="nimble-pool-spend__total-label">{summary.label}</span>
								</span>
							{/if}
						{/each}
						{#if state.poolBonus > 0}
							<span class="nimble-pool-spend__total-part">+{state.poolBonus}</span>
						{/if}
						{#each state.chargeBonusFragments as fragment, i (i)}
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
		{#each state.modifiedFormulas as damageEffect}
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
				<input
					type="checkbox"
					bind:checked={state.shouldRollBeHidden}
					class="modifier-item__checkbox"
				/>
			</label>
		</div>
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={onSubmit}>
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
		background: color-mix(in srgb, var(--nimble-sheet-background) 92%, transparent);
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
				color: var(--nimble-pool-spend-icon-color);
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
			background: color-mix(in srgb, var(--nimble-pool-spend-die-border-color) 12%, transparent);
			border: 2px solid var(--nimble-pool-spend-die-border-color);
			border-radius: 4px;
			font-weight: 700;
			color: var(--nimble-pool-spend-die-text-color);
			cursor: pointer;
			transition:
				background 0.12s ease,
				color 0.12s ease,
				transform 0.08s ease;

			&:hover {
				background: color-mix(in srgb, var(--nimble-pool-spend-die-border-color) 22%, transparent);
			}

			&--selected {
				background: var(--nimble-pool-spend-die-selected-background);
				border-color: var(--nimble-pool-spend-die-selected-border-color);
				color: var(--nimble-pool-spend-die-selected-text-color);
				transform: scale(0.93);
			}
		}

		&__row--auto {
			.nimble-pool-spend__label i {
				color: var(--nimble-pool-spend-auto-icon-color);
			}
		}

		&__auto {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__auto-faces {
			display: inline-flex;
			gap: 0.25rem;
		}

		&__auto-face {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 1.5rem;
			height: 1.5rem;
			padding: 0 0.3rem;
			background: var(--nimble-pool-spend-auto-face-background);
			border: 1px solid var(--nimble-pool-spend-auto-face-border-color);
			border-radius: 3px;
			font-size: 0.8125rem;
			font-weight: 700;
			color: var(--nimble-pool-spend-auto-face-text-color);
		}

		&__auto-total {
			font-weight: 700;
			color: var(--nimble-pool-spend-auto-total-color);
			font-variant-numeric: tabular-nums;
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
			background: color-mix(in srgb, var(--nimble-pool-spend-die-border-color) 12%, transparent);
			border: 1px solid var(--nimble-pool-spend-die-border-color);
			border-radius: 4px;
			font-size: 1rem;
			font-weight: 700;
			line-height: 1;
			color: var(--nimble-pool-spend-die-text-color);
			cursor: pointer;
			transition: background 0.12s ease;

			&:hover:not(:disabled) {
				background: color-mix(in srgb, var(--nimble-pool-spend-die-border-color) 22%, transparent);
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
			color: var(--nimble-pool-spend-total-color);
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
