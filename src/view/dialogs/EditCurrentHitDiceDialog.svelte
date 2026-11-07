<script lang="ts">
	import { untrack } from 'svelte';
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	let { document: actor, dialog }: Props = $props();

	// Get hit dice data from the HitDiceManager
	const hitDice = $derived(actor.HitDiceManager.bySize);

	// Initialize current values from existing data
	let currentValues: Record<string, number> = $state(
		untrack(() =>
			Object.fromEntries(
				Object.entries(hitDice)
					.filter(([_, data]) => data.total > 0)
					.map(([die, data]) => [die, data.current]),
			),
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
	:global(.nimble-window) .nimble-sheet__body.nimble-edit-current-hd-dialog {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 4px 12px 12px;
	}

	:global(.nimble-window)
		.nimble-edit-current-hd-dialog
		> section:first-child
		> .nimble-section-header {
		margin-top: 0;
	}

	.nimble-edit-current-hd-dialog {
		&__dice-list {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		&__die-row {
			display: grid;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 12px;
			padding: 5px 8px;
			border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
			border-radius: 4px;
		}

		&__die-label-group {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;
			min-width: 3rem;
		}

		&__die-label {
			font-size: 0.875rem;
			font-weight: 900;
			letter-spacing: 0.06em;
			text-align: center;
			color: var(--nimble-bronze);
		}

		&__empty-badge {
			padding: 0 5px;
			border-radius: 3px;
			box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
			font-size: 0.656rem;
			font-weight: 800;
			line-height: 16px;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-ui-ink-muted);

			&--hidden {
				visibility: hidden;
			}
		}

		&__controls {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
		}

		&__control-btn,
		&__max-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 26px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-family: var(--nimble-primary-font);
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--nimble-ui-ink);
			cursor: pointer;
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			&:hover:not(:disabled) {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}

			&:disabled {
				border-style: dashed;
				background: none;
				color: var(--nimble-ui-ink-muted);
				cursor: default;
			}
		}

		&__control-btn {
			width: 26px;
			padding: 0;

			i {
				font-size: 0.75rem;
			}
		}

		&__max-btn {
			padding: 0 9px;
			white-space: nowrap;
		}

		&__value {
			min-width: 2rem;
			text-align: center;
			font-size: 1rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}

		&__max-group {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		&__max-label {
			font-size: 0.813rem;
			font-weight: 700;
			color: var(--nimble-ui-ink-muted);
		}

		&__total {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: 8px;
			padding: 6px 4px 0;
			border-top: 1px solid var(--nimble-ui-soft);
		}

		&__total-label {
			font-size: 0.75rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--nimble-ui-ink-dim);
		}

		&__total-value {
			font-size: 1.15rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
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
