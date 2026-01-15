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

	// Check if the actor has the maximizeHitDice flag from rules (e.g., Oozeling's Odd Constitution)
	const maximizeHitDice =
		(actor.system.attributes as { maximizeHitDice?: boolean }).maximizeHitDice ?? false;
	const maximizeHitDiceContributions = ((
		actor.system.attributes as { maximizeHitDiceContributions?: Array<{ label: string }> }
	).maximizeHitDiceContributions ?? []) as Array<{ label: string }>;

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
			<h3 class="nimble-heading" data-heading-variant="section">
				{CONFIG.NIMBLE.hitDice.selectToRoll}
			</h3>
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
									aria-label={game.i18n.format(CONFIG.NIMBLE.hitDice.removeDie, { size: die })}
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
									aria-label={game.i18n.format(CONFIG.NIMBLE.hitDice.addDie, { size: die })}
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
									aria-label={game.i18n.format(CONFIG.NIMBLE.hitDice.selectAllDie, { size: die })}
									data-tooltip={CONFIG.NIMBLE.hitDice.selectAll}
								>
									{CONFIG.NIMBLE.hitDice.max}
								</button>
							</div>
						{:else}
							<div class="nimble-roll-hit-dice-dialog__controls">
								<button
									class="nimble-button nimble-roll-hit-dice-dialog__control-btn nimble-roll-hit-dice-dialog__control-btn--depleted"
									data-button-variant="icon"
									type="button"
									disabled
									aria-label={CONFIG.NIMBLE.hitDice.depleted}
								>
									<i class="fa-solid fa-circle-xmark"></i>
								</button>
								<span class="nimble-roll-hit-dice-dialog__depleted-text"
									>{CONFIG.NIMBLE.hitDice.depleted}</span
								>
								<button
									class="nimble-button nimble-roll-hit-dice-dialog__control-btn"
									data-button-variant="icon"
									type="button"
									disabled
									style="visibility: hidden;"
									aria-hidden="true"
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
			<span
				>{game.i18n.format(CONFIG.NIMBLE.hitDice.addStrBonus, {
					bonus: actor.system.abilities.strength.mod,
				})}</span
			>
		</label>

		<label class="nimble-roll-hit-dice-dialog__checkbox-label">
			<input type="checkbox" bind:checked={applyToHP} />
			<span>{CONFIG.NIMBLE.hitDice.applyHealingToHP}</span>
		</label>
	</section>

	{#if maximizeHitDice}
		<section class="nimble-roll-hit-dice-dialog__modifiers">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{CONFIG.NIMBLE.fieldRest.modifiers}
				</h3>
			</header>
			<div class="modifier-item modifier-item--maximize">
				<i class="modifier-item__icon fa-solid fa-arrow-up"></i>
				<span class="modifier-item__text">{CONFIG.NIMBLE.fieldRest.maximizeHitDice}</span>
				{#if maximizeHitDiceContributions.length > 0}
					<span class="modifier-item__source">
						({maximizeHitDiceContributions.map((c) => c.label).join(', ')})
					</span>
				{/if}
			</div>
		</section>
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit} disabled={!canRoll}>
		<i class="fa-solid fa-dice"></i>
		{game.i18n.format(CONFIG.NIMBLE.hitDice.rollHitDice, {
			count: totalSelected,
			dieWord: totalSelected === 1 ? 'Die' : 'Dice',
		})}
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
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;

			&--depleted {
				opacity: 0.6;
				background: var(--nimble-input-background-color);
			}
		}

		&__depleted-text {
			width: 3rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			font-style: italic;
			color: var(--nimble-medium-text-color);
		}

		&__die-label {
			font-weight: 700;
			font-size: var(--nimble-md-text);
			color: var(--nimble-dark-text-color);
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
				color: var(--nimble-medium-text-color);
			}
		}

		&__input {
			width: 3rem;
			text-align: center;
			font-weight: 600;
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			color: var(--nimble-dark-text-color);
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
			color: var(--nimble-dark-text-color);
			white-space: nowrap;
			background: var(--nimble-input-background-color);
			border: 1px solid var(--nimble-card-border-color);
			padding: 0.125rem 0.375rem;
			border-radius: 3px;
			cursor: pointer;
			transition:
				background-color 0.15s ease-in-out,
				border-color 0.15s ease-in-out;

			&:hover:not(:disabled) {
				background: hsl(45, 50%, 50%);
				border-color: hsl(45, 50%, 40%);
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
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__checkbox-label {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			cursor: pointer;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);

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

	.nimble-roll-hit-dice-dialog__modifiers {
		margin-block-start: 1rem;
		padding-block-start: 0.75rem;
		border-top: 1px solid var(--nimble-card-border-color);
	}

	.modifier-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&--maximize {
			background: linear-gradient(
				135deg,
				hsla(120, 45%, 45%, 0.15) 0%,
				hsla(120, 45%, 40%, 0.08) 100%
			);
			border-color: hsla(120, 45%, 45%, 0.4);
		}

		&__icon {
			font-size: var(--nimble-sm-text);
			color: hsl(120, 45%, 35%);
		}

		&__text {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__source {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
		}
	}

	:global(.theme-dark) .modifier-item {
		&--maximize {
			background: linear-gradient(
				135deg,
				hsla(120, 45%, 45%, 0.2) 0%,
				hsla(120, 45%, 40%, 0.1) 100%
			);
			border-color: hsla(120, 45%, 45%, 0.5);
		}

		&--maximize .modifier-item__icon {
			color: hsl(120, 50%, 55%);
		}

		&--maximize .modifier-item__text {
			color: var(--nimble-light-text-color);
		}
	}
</style>
