<script lang="ts">
	import { untrack } from 'svelte';
	import type { ItemActivationConfigDialogProps } from '#types/components/ItemActivationConfigDialog.d.ts';
	import { getDieFaceIcon } from '#utils/dicePool/dieFaceIcons.js';
	import localize from '#utils/localize.js';
	import { SYSTEM_ID } from '#system';
	import { createItemActivationConfigDialogState } from './itemActivationConfigDialogState.svelte.ts';
	import RollModeField from './components/RollModeField.svelte';
	import RollModifierFields from './components/RollModifierFields.svelte';
	import RollWindow from './components/RollWindow.svelte';
	import { rollSpendLine } from './components/rollSpendLine.ts';

	const { skillCheckDialog, damageTypes } = CONFIG.NIMBLE;

	let {
		actor,
		dialog,
		item,
		rollMode,
		rushedAttack,
		spendsActions,
	}: ItemActivationConfigDialogProps = $props();
	const spendLine = $derived(rollSpendLine(spendsActions));

	const state = createItemActivationConfigDialogState({
		actor: () => actor,
		item: () => item,
		initialRollMode: untrack(() => rollMode),
		hideRollsDefault: !!game.settings.get(SYSTEM_ID, 'hideRolls'),
	});

	function onSubmit() {
		if (state.situationalModifiers !== '') {
			const isValid = Roll.validate(state.situationalModifiers);
			if (!isValid) {
				ui.notifications?.warn(localize('NIMBLE.hitDice.invalidAddToRoll'));
				return;
			}
		}
		if (state.primaryDieValue != null) {
			const roll = new Roll(state.damageFormula);
			const terms = roll.terms;
			const firstDieIndex = terms.findIndex((t) => t instanceof foundry.dice.terms.Die);
			const firstDie = terms[firstDieIndex] as { faces?: number } | undefined;
			if (!firstDie?.faces || state.primaryDieValue > firstDie.faces || state.primaryDieValue < 0) {
				ui.notifications?.warn(localize('NIMBLE.hitDice.invalidSetPrimaryDie'));
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
			// Fold any "advantage" conditional-bonus choices into the roll mode; "damage"
			// choices are already baked into the modified formula below. Clamp the sum to
			// the ±6 convention so stacked advantage can't push past what the UI allows.
			rollMode: Math.clamp(state.selectedRollMode + state.conditionalAdvantageTotal, -6, 6),
			rollFormula: state.modifiedFormulas[0]?.formula || '0',
			situationalModifiers: state.situationalModifiers,
			primaryDieValue: state.primaryDieValue,
			primaryDieModifier: state.primaryDieModifier,
			rollHidden: state.shouldRollBeHidden,
			consumedPoolDice,
			consumedChargePools,
			consumedVariableCharges: state.consumedVariableCharges,
			// Typed conditional-bonus damage rolls as its own damage effect so the
			// chosen type applies; untyped choices are already folded into rollFormula.
			conditionalDamages: state.conditionalTypedDamages,
		});
	}
</script>

<RollWindow
	title={item.name}
	img={item.img}
	rollLabel={localize('NIMBLE.rollWindow.roll')}
	oncancel={() => dialog.close()}
	onroll={onSubmit}
>
	{#if spendLine}<p class="spends">{spendLine}</p>{/if}

	<RollModeField bind:value={state.selectedRollMode} {rushedAttack} />

	{#if state.hasConditionalBonuses}
		<div>
			<div class="nimble-conditional-bonus">
				<h5 class="lb">
					{localize('NIMBLE.activationDialog.conditionalBonus.heading')}
				</h5>

				{#each state.conditionalBonusOptions as option (option.key)}
					{@const choice = state.conditionalChoices[option.key]}
					{@const damageLabel = option.damageFormula ?? `${option.damageValue ?? 0}`}
					<div class="nimble-conditional-bonus__row">
						<span class="nimble-conditional-bonus__label">{option.label}</span>
						<div class="nimble-conditional-bonus__choices">
							{#if option.advantage > 0}
								<button
									type="button"
									class="nimble-conditional-bonus__choice"
									class:nimble-conditional-bonus__choice--selected={choice === 'advantage'}
									aria-pressed={choice === 'advantage'}
									onclick={() => state.setConditionalChoice(option.key, 'advantage')}
								>
									{localize('NIMBLE.activationDialog.conditionalBonus.advantage', {
										count: option.advantage,
									})}
								</button>
							{/if}
							{#if option.damageValue !== null || option.damageFormula !== null}
								<button
									type="button"
									class="nimble-conditional-bonus__choice"
									class:nimble-conditional-bonus__choice--selected={choice === 'damage'}
									aria-pressed={choice === 'damage'}
									onclick={() => state.setConditionalChoice(option.key, 'damage')}
								>
									{localize('NIMBLE.activationDialog.conditionalBonus.damage', {
										value: damageLabel,
									})}
								</button>
							{/if}
							<button
								type="button"
								class="nimble-conditional-bonus__choice"
								class:nimble-conditional-bonus__choice--selected={choice === 'none'}
								aria-pressed={choice === 'none'}
								onclick={() => state.setConditionalChoice(option.key, 'none')}
							>
								{localize('NIMBLE.activationDialog.conditionalBonus.none')}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<RollModifierFields
		bind:situationalModifiers={state.situationalModifiers}
		bind:primaryDieValue={state.primaryDieValue}
		bind:primaryDieModifier={state.primaryDieModifier}
	/>

	{#if state.variableChargeSpends.length > 0}
		<div>
			<div class="nimble-pool-spend">
				<h5 class="lb">
					{localize('NIMBLE.activationDialog.spendCharge.heading')}
				</h5>

				{#each state.variableChargeSpends as spend (spend.poolId)}
					{@const selected = state.variableSpendCounts[spend.poolId] ?? spend.minimum}
					<div class="nimble-pool-spend__row">
						<span class="nimble-pool-spend__label">{spend.label}</span>
						<div class="nimble-pool-spend__stepper">
							<button
								type="button"
								class="nimble-pool-spend__stepper-btn"
								aria-label={localize('NIMBLE.activationDialog.spendCharge.decrement', {
									pool: spend.label,
								})}
								disabled={selected <= spend.minimum}
								onclick={() => state.adjustVariableSpend(spend.poolId, -1)}
							>
								−
							</button>
							<span class="nimble-pool-spend__stepper-value">
								<input
									class="nimble-pool-spend__stepper-input"
									type="number"
									min={spend.minimum}
									max={spend.limit}
									value={selected}
									aria-label={localize('NIMBLE.activationDialog.spendCharge.amount', {
										pool: spend.label,
									})}
									onchange={({ currentTarget }) => {
										state.setVariableSpend(spend.poolId, currentTarget.valueAsNumber);
										// The clamp often lands on the value already stored — typing 99 at
										// the limit, or clearing the field — which leaves Svelte nothing to
										// push back, so the box would keep showing what was typed.
										currentTarget.value = String(state.variableSpendCounts[spend.poolId]);
									}}
								/>
								<span class="nimble-pool-spend__stepper-available" aria-hidden="true">
									/ {spend.limit}
								</span>
							</span>
							<button
								type="button"
								class="nimble-pool-spend__stepper-btn"
								aria-label={localize('NIMBLE.activationDialog.spendCharge.increment', {
									pool: spend.label,
								})}
								disabled={selected >= spend.limit}
								onclick={() => state.adjustVariableSpend(spend.poolId, 1)}
							>
								+
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if state.hasSpendablePools}
		<div>
			<div class="nimble-pool-spend">
				<h5 class="lb">
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
								aria-label={localize('NIMBLE.activationDialog.spendCharge.decrement', {
									pool: pool.label,
								})}
								disabled={selected <= 0}
								onclick={() => state.adjustChargeSpend(pool.id, -1)}
							>
								−
							</button>
							<span class="nimble-pool-spend__stepper-value">
								<strong>{selected}</strong>{pool.dieSize}
								<span class="nimble-pool-spend__stepper-available" aria-hidden="true">
									/ {pool.current}
								</span>
							</span>
							<button
								type="button"
								class="nimble-pool-spend__stepper-btn"
								aria-label={localize('NIMBLE.activationDialog.spendCharge.increment', {
									pool: pool.label,
								})}
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

	{#each state.damagePreviews as damageEffect}
		<div class="frm">
			{#if damageEffect.damageType}
				{game.i18n.localize(damageTypes[damageEffect.damageType] || damageEffect.damageType)}:
			{/if}
			{Roll.replaceFormulaData(damageEffect.formula, actor.getRollData(item))}
		</div>
	{/each}
	{#if game.user?.isGM}
		<label class="check">
			<input type="checkbox" bind:checked={state.shouldRollBeHidden} />
			<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
			<span>{skillCheckDialog.hideRoll}</span>
		</label>
	{/if}
</RollWindow>

<style lang="scss">
	.spends {
		margin: 0;
		font-size: 0.781rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}

	.nimble-conditional-bonus {
		display: flex;
		flex-direction: column;
		gap: 6px;

		&__row {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		&__label {
			font-size: 0.75rem;
			font-weight: 600;
		}

		&__choices {
			display: flex;
			gap: 4px;
		}

		&__choice {
			flex: 1;
			min-width: 0;
			width: auto;
			height: 30px;
			padding: 0 6px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--nimble-ui-ink);

			&:hover {
				border-color: var(--nimble-ui-highlight);
			}

			&--selected {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-soft);
			}
		}
	}

	.nimble-pool-spend {
		display: flex;
		flex-direction: column;
		gap: 6px;

		&__row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-wrap: wrap;
			gap: 6px 8px;
		}

		&__label {
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 0;
			font-size: 0.75rem;
			font-weight: 600;
		}

		&__dice,
		&__auto-faces {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
		}

		&__auto {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		&__die,
		&__auto-face {
			display: grid;
			place-items: center;
			width: 28px;
			height: 28px;
			padding: 0;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			font-size: 0.812rem;
			font-weight: 700;
			color: var(--nimble-ui-ink);
		}

		&__die:hover {
			border-color: var(--nimble-ui-highlight);
		}

		&__die--selected {
			border-color: var(--nimble-crimson);
			background: var(--nimble-crimson);
			color: var(--nimble-ui-fill-ink);
		}

		&__auto-total {
			font-weight: 700;
			font-variant-numeric: tabular-nums;
		}

		&__stepper {
			display: flex;
			align-items: center;
			gap: 6px;
		}

		&__stepper-btn {
			display: grid;
			place-items: center;
			width: 28px;
			height: 28px;
			padding: 0;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			font-size: 0.875rem;
			font-weight: 700;
			color: var(--nimble-ui-ink);

			&:hover:not(:disabled) {
				border-color: var(--nimble-ui-highlight);
			}

			&:disabled {
				opacity: 0.4;
			}
		}

		&__stepper-value {
			display: flex;
			align-items: baseline;
			gap: 3px;
			font-size: 0.812rem;
			font-variant-numeric: tabular-nums;
		}

		&__stepper-input {
			width: 2.5em;
			height: 28px;
			padding: 0 4px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 2px;
			background: var(--nimble-ui-well);
			box-shadow: none;
			text-align: center;
			font-weight: 700;
			color: var(--nimble-ui-ink);
		}

		&__stepper-available {
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-muted);
		}

		&__total {
			display: flex;
			flex-wrap: wrap;
			justify-content: flex-end;
			gap: 4px 10px;
			font-size: 0.812rem;
			font-weight: 700;
		}

		&__total-part {
			display: inline-flex;
			align-items: baseline;
			gap: 3px;
		}

		&__total-label {
			font-size: 0.75rem;
			font-weight: 500;
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>
