<!--
@component
A row with a label and a − / + stepper with a number box, for an amount the player chooses.
-->
<script lang="ts">
	import type { AmountStepperProps } from '#types/components/AmountStepper.d.ts';

	let { label, value, minimum, limit, words, onadjust, onset }: AmountStepperProps = $props();
</script>

<div class="nimble-pool-spend__row">
	<span class="nimble-pool-spend__label">{label}</span>
	<div class="nimble-pool-spend__stepper">
		<button
			type="button"
			class="nimble-pool-spend__stepper-btn"
			aria-label={words.decrement}
			disabled={value <= minimum}
			onclick={() => onadjust(-1)}
		>
			−
		</button>
		<span class="nimble-pool-spend__stepper-value">
			<input
				class="nimble-pool-spend__stepper-input"
				type="number"
				min={minimum}
				max={limit}
				{value}
				aria-label={words.amount}
				onchange={({ currentTarget }) => {
					// The clamp often lands on the value already stored, which leaves Svelte
					// nothing to push back, so the box would keep showing what was typed.
					currentTarget.value = String(onset(currentTarget.valueAsNumber));
				}}
			/>
			<span class="nimble-pool-spend__stepper-available" aria-hidden="true">/ {limit}</span>
		</span>
		<button
			type="button"
			class="nimble-pool-spend__stepper-btn"
			aria-label={words.increment}
			disabled={value >= limit}
			onclick={() => onadjust(1)}
		>
			+
		</button>
	</div>
</div>

<style lang="scss">
	.nimble-pool-spend {
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
	}
</style>
