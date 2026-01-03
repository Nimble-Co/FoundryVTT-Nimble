<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	let { document: actor, dialog }: Props = $props();

	// Get hit dice data - use HitDiceManager which is refreshed on actor update
	const hitDice = actor.HitDiceManager.bySize;

	// Initialize selections to 0 for each die size
	let selections: Record<string, number> = $state(
		Object.fromEntries(Object.keys(hitDice).map((die) => [die, 0])),
	);
	let addStrBonus = $state(true);
	let applyToHP = $state(true);

	// Calculate total selected dice
	let totalSelected = $derived(Object.values(selections).reduce((sum, val) => sum + val, 0));

	// Check if any dice are selected
	let canRoll = $derived(totalSelected > 0);

	function incrementDie(die: string) {
		const current = selections[die] ?? 0;
		const max = hitDice[die]?.current ?? 0;
		if (current < max) {
			selections[die] = current + 1;
		}
	}

	function decrementDie(die: string) {
		const current = selections[die] ?? 0;
		if (current > 0) {
			selections[die] = current - 1;
		}
	}

	function submit() {
		// Create a plain object copy to avoid Svelte 5 proxy issues
		const selectionsCopy: Record<string, number> = {};
		for (const [key, value] of Object.entries(selections)) {
			selectionsCopy[key] = value;
		}
		dialog.submit({
			selections: selectionsCopy,
			addStrBonus,
			applyToHP,
		});
	}
</script>

<article class="nimble-sheet__body nimble-roll-hit-dice-dialog">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Select Hit Dice to Roll</h3>
		</header>

		<div class="nimble-roll-hit-dice-dialog__dice-list">
			{#each Object.entries(hitDice) as [die, { current, total }]}
				{#if total > 0}
					<div
						class="nimble-roll-hit-dice-dialog__die-row"
						class:nimble-roll-hit-dice-dialog__die-row--depleted={current === 0}
					>
						<span class="nimble-roll-hit-dice-dialog__die-label">d{die}</span>

						{#if current > 0}
							<div class="nimble-roll-hit-dice-dialog__controls">
								<button
									class="nimble-button nimble-roll-hit-dice-dialog__control-btn"
									data-button-variant="icon"
									type="button"
									disabled={selections[die] <= 0}
									onclick={() => decrementDie(die)}
									aria-label="Remove one d{die}"
								>
									<i class="fa-solid fa-minus"></i>
								</button>

								<input
									class="nimble-roll-hit-dice-dialog__input"
									type="number"
									min="0"
									max={current}
									value={selections[die] ?? 0}
									onchange={(e) => {
										const val = Math.max(0, Math.min(current, Number(e.currentTarget.value)));
										selections[die] = val;
									}}
								/>

								<button
									class="nimble-button nimble-roll-hit-dice-dialog__control-btn"
									data-button-variant="icon"
									type="button"
									disabled={(selections[die] ?? 0) >= current}
									onclick={() => incrementDie(die)}
									aria-label="Add one d{die}"
								>
									<i class="fa-solid fa-plus"></i>
								</button>
							</div>

							<div class="nimble-roll-hit-dice-dialog__available-group">
								<span class="nimble-roll-hit-dice-dialog__available">
									{current} / {total}
								</span>
								<button
									class="nimble-button nimble-roll-hit-dice-dialog__max-btn"
									data-button-variant="text"
									type="button"
									disabled={(selections[die] ?? 0) >= current}
									onclick={() => (selections[die] = current)}
									aria-label="Select all d{die}"
									data-tooltip="Select all"
								>
									Max
								</button>
							</div>
						{:else}
							<div class="nimble-roll-hit-dice-dialog__controls">
								<button
									class="nimble-button nimble-roll-hit-dice-dialog__control-btn nimble-roll-hit-dice-dialog__control-btn--depleted"
									data-button-variant="icon"
									type="button"
									disabled
								>
									<i class="fa-solid fa-circle-xmark"></i>
								</button>
								<span class="nimble-roll-hit-dice-dialog__depleted-text">Depleted</span>
								<button
									class="nimble-button nimble-roll-hit-dice-dialog__control-btn"
									data-button-variant="icon"
									type="button"
									disabled
									style="visibility: hidden;"
								>
									<i class="fa-solid fa-plus"></i>
								</button>
							</div>

							<span class="nimble-roll-hit-dice-dialog__available">
								0 / {total}
							</span>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<section class="nimble-roll-hit-dice-dialog__options">
		<label class="nimble-roll-hit-dice-dialog__checkbox-label">
			<input type="checkbox" bind:checked={addStrBonus} />
			<span>Add STR bonus (+{actor.system.abilities.strength.mod} per die)</span>
		</label>

		<label class="nimble-roll-hit-dice-dialog__checkbox-label">
			<input type="checkbox" bind:checked={applyToHP} />
			<span>Apply healing to HP</span>
		</label>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit} disabled={!canRoll}>
		<i class="fa-solid fa-dice"></i>
		Roll {totalSelected} Hit {totalSelected === 1 ? 'Die' : 'Dice'}
	</button>
</footer>

<style lang="scss">
	.nimble-roll-hit-dice-dialog {
		--nimble-sheet-body-padding-block-start: 0.5rem;

		&__dice-list {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		&__die-row {
			display: grid;
			grid-template-columns: 3rem 1fr auto;
			align-items: center;
			gap: 0.75rem;
			padding: 0.5rem;
			background: var(--nimble-card-background);
			border-radius: 4px;
			box-shadow: var(--nimble-card-box-shadow);

			&--depleted {
				opacity: 0.6;
				background: var(--nimble-card-background-muted, hsl(0, 0%, 90%));
			}
		}

		&__depleted-text {
			width: 3rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			font-style: italic;
			color: var(--nimble-muted-text-color, hsl(0, 0%, 50%));
		}

		&__die-label {
			font-weight: 700;
			font-size: var(--nimble-md-text);
			text-align: center;
		}

		&__controls {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}

		&__control-btn {
			--nimble-button-padding: 0.25rem 0.5rem;

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			&--depleted {
				opacity: 1;
				cursor: default;
				pointer-events: none;
				color: var(--nimble-muted-text-color, hsl(0, 0%, 50%));
			}
		}

		&__input {
			width: 3rem;
			text-align: center;
			font-weight: 600;
		}

		&__available-group {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__available {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}

		&__max-btn {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-link-color, hsl(210, 60%, 45%));
			white-space: nowrap;
			background: none;
			border: 1px solid currentColor;
			padding: 0.125rem 0.375rem;
			border-radius: 3px;
			cursor: pointer;
			transition:
				background-color 0.15s ease-in-out,
				color 0.15s ease-in-out;

			&:hover:not(:disabled) {
				background: var(--nimble-link-color, hsl(210, 60%, 45%));
				color: #fff;
			}

			&:disabled {
				opacity: 0.4;
				cursor: default;
			}
		}

		&__options {
			margin-block-start: 1rem;
			padding-block-start: 0.75rem;
			border-top: 1px solid var(--nimble-border-color);
		}

		&__checkbox-label {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			cursor: pointer;
			font-size: var(--nimble-sm-text);

			input[type='checkbox'] {
				width: 1rem;
				height: 1rem;
				cursor: pointer;
			}
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
