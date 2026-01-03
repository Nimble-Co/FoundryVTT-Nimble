<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	let { document: actor, dialog }: Props = $props();

	// Get hit dice data from the HitDiceManager
	const hitDice = actor.HitDiceManager.bySize;

	// Initialize current values from existing data
	let currentValues: Record<string, number> = $state(
		Object.fromEntries(
			Object.entries(hitDice)
				.filter(([_, data]) => data.total > 0)
				.map(([die, data]) => [die, data.current]),
		),
	);

	// Get sorted die sizes (highest first for visual hierarchy)
	let dieSizes = $derived(
		Object.entries(hitDice)
			.filter(([_, data]) => data.total > 0)
			.sort(([a], [b]) => Number(b) - Number(a))
			.map(([size]) => size),
	);

	function increment(die: string) {
		const max = hitDice[die]?.total ?? 0;
		const current = currentValues[die] ?? 0;
		if (current < max) {
			currentValues[die] = current + 1;
		}
	}

	function decrement(die: string) {
		const current = currentValues[die] ?? 0;
		if (current > 0) {
			currentValues[die] = current - 1;
		}
	}

	function setToMax(die: string) {
		const max = hitDice[die]?.total ?? 0;
		currentValues[die] = max;
	}

	function submit() {
		// Create a plain object copy to avoid Svelte 5 proxy issues
		const valuesCopy: Record<string, number> = {};
		for (const [key, value] of Object.entries(currentValues)) {
			valuesCopy[key] = value;
		}
		dialog.submit({ currentValues: valuesCopy });
	}

	// Calculate totals
	let totalCurrent = $derived(Object.values(currentValues).reduce((sum, val) => sum + val, 0));
	let totalMax = $derived(
		Object.entries(hitDice)
			.filter(([_, data]) => data.total > 0)
			.reduce((sum, [_, data]) => sum + data.total, 0),
	);
</script>

<article class="nimble-sheet__body nimble-edit-current-hd-dialog">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Current Hit Dice</h3>
		</header>

		<div class="nimble-edit-current-hd-dialog__dice-list">
			{#each dieSizes as die}
				{@const max = hitDice[die]?.total ?? 0}
				{@const current = currentValues[die] ?? 0}
				{@const isEmpty = current === 0}
				{@const isFull = current >= max}

				<div class="nimble-edit-current-hd-dialog__die-row">
					<div class="nimble-edit-current-hd-dialog__die-label-group">
						<span class="nimble-edit-current-hd-dialog__die-label">d{die}</span>
						<span
							class="nimble-edit-current-hd-dialog__empty-badge"
							class:nimble-edit-current-hd-dialog__empty-badge--hidden={!isEmpty}
						>
							Empty
						</span>
					</div>

					<div class="nimble-edit-current-hd-dialog__controls">
						<button
							class="nimble-edit-current-hd-dialog__control-btn"
							type="button"
							disabled={isEmpty}
							onclick={() => decrement(die)}
							aria-label="Remove one d{die}"
						>
							<i class="fa-solid fa-minus"></i>
						</button>

						<span class="nimble-edit-current-hd-dialog__value">
							{current}
						</span>

						<button
							class="nimble-edit-current-hd-dialog__control-btn"
							type="button"
							disabled={isFull}
							onclick={() => increment(die)}
							aria-label="Add one d{die}"
						>
							<i class="fa-solid fa-plus"></i>
						</button>
					</div>

					<div class="nimble-edit-current-hd-dialog__max-group">
						<span class="nimble-edit-current-hd-dialog__max-label">/ {max}</span>

						<button
							class="nimble-edit-current-hd-dialog__max-btn"
							type="button"
							disabled={isFull}
							onclick={() => setToMax(die)}
							aria-label="Set d{die} to max"
							data-tooltip="Restore all"
						>
							Max
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="nimble-edit-current-hd-dialog__total">
		<span class="nimble-edit-current-hd-dialog__total-label">Total</span>
		<span class="nimble-edit-current-hd-dialog__total-value">{totalCurrent} / {totalMax}</span>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}>
		<i class="fa-solid fa-check"></i>
		Save
	</button>
</footer>

<style lang="scss">
	.nimble-edit-current-hd-dialog {
		--nimble-sheet-body-padding-block-start: 0.5rem;

		&__dice-list {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
		}

		&__die-row {
			display: grid;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 0.75rem;
			padding: 0.625rem 0.75rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
		}

		&__die-label-group {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.125rem;
			min-width: 3rem;
		}

		&__die-label {
			font-weight: 700;
			font-size: var(--nimble-lg-text);
			color: var(--nimble-dark-text-color);
			text-align: center;
		}

		&__empty-badge {
			font-size: 0.5625rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			padding: 0.0625rem 0.25rem;
			background: hsl(0, 45%, 55%);
			color: #fff;
			border-radius: 3px;

			&--hidden {
				visibility: hidden;
			}
		}

		&__controls {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.75rem;
		}

		&__control-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			padding: 0;
			font-size: var(--nimble-sm-text);
			background: var(--nimble-basic-button-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			color: var(--nimble-dark-text-color);
			cursor: pointer;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
			transition: all 0.15s ease;

			&:hover:not(:disabled) {
				background: hsl(45, 50%, 50%);
				border-color: hsl(45, 50%, 40%);
				color: #fff;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
			}

			&:active:not(:disabled) {
				transform: translateY(1px);
				box-shadow: none;
			}

			&:disabled {
				opacity: 0.35;
				cursor: not-allowed;
			}
		}

		&__value {
			min-width: 2.5rem;
			text-align: center;
			font-size: var(--nimble-xl-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__max-group {
			display: flex;
			align-items: center;
			gap: 0.625rem;
		}

		&__max-label {
			font-size: var(--nimble-base-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__max-btn {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			white-space: nowrap;
			background: var(--nimble-basic-button-background-color);
			border: 1px solid var(--nimble-card-border-color);
			padding: 0.25rem 0.5rem;
			border-radius: 4px;
			cursor: pointer;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
			transition: all 0.15s ease;

			&:hover:not(:disabled) {
				background: hsl(139, 45%, 45%);
				border-color: hsl(139, 45%, 35%);
				color: #fff;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
			}

			&:active:not(:disabled) {
				transform: translateY(1px);
				box-shadow: none;
			}

			&:disabled {
				opacity: 0.35;
				cursor: default;
			}
		}

		&__total {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-block-start: 0.75rem;
			padding: 0.625rem 0.75rem;
			background: linear-gradient(to right, hsl(45, 45%, 40%), hsl(45, 50%, 50%));
			border-radius: 6px;
		}

		&__total-label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: hsl(45, 30%, 95%);
			text-transform: uppercase;
			letter-spacing: 0.03em;
		}

		&__total-value {
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			color: #fff;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;

		.nimble-button {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}
	}
</style>
