<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	function incrementHitDie(die: string) {
		const current = hitDice[die]?.current ?? 0;
		selectedHitDice = { ...selectedHitDice, [die]: Math.min(selectedHitDice[die] + 1, current) };
	}

	function decrementHitDie(die: string) {
		selectedHitDice = { ...selectedHitDice, [die]: Math.max(selectedHitDice[die] - 1, 0) };
	}

	function maxHitDie(die: string) {
		const current = hitDice[die]?.current ?? 0;
		selectedHitDice = { ...selectedHitDice, [die]: current };
	}

	function submit() {
		dialog.submit({
			makeCamp,
			selectedHitDice: { ...selectedHitDice },
		});
	}

	let { document: actor, dialog }: Props = $props();

	const hitDice = actor.HitDiceManager.bySize;

	let makeCamp = $state(false);
	let selectedHitDice = $state(Object.fromEntries(Object.keys(hitDice).map((die) => [die, 0])));

	const totalSelected = $derived(Object.values(selectedHitDice).reduce((sum, val) => sum + val, 0));
</script>

<article class="nimble-sheet__body field-rest-dialog">
	<section class="field-rest-dialog__section">
		<h3 class="field-rest-dialog__heading">Rest Type</h3>

		<div class="field-rest-dialog__rest-types">
			<label class="rest-type-card" class:rest-type-card--active={!makeCamp}>
				<input
					class="rest-type-card__input"
					type="radio"
					name="{actor.uuid}-field-rest-type"
					value={false}
					bind:group={makeCamp}
				/>
				<div class="rest-type-card__header">
					<i class="rest-type-card__icon fa-solid fa-wind"></i>
					<span class="rest-type-card__title">Catch Breath</span>
				</div>
				<p class="rest-type-card__description">10 min rest. Roll Hit Dice + STR to heal.</p>
			</label>

			<label class="rest-type-card" class:rest-type-card--active={makeCamp}>
				<input
					class="rest-type-card__input"
					type="radio"
					name="{actor.uuid}-field-rest-type"
					value={true}
					bind:group={makeCamp}
				/>
				<div class="rest-type-card__header">
					<i class="rest-type-card__icon fa-solid fa-campground"></i>
					<span class="rest-type-card__title">Make Camp</span>
				</div>
				<p class="rest-type-card__description">8 hour rest. Take max Hit Die value + STR.</p>
			</label>
		</div>
	</section>

	<section class="field-rest-dialog__section">
		<h3 class="field-rest-dialog__heading">Hit Dice to Spend</h3>

		<div class="hit-dice-grid">
			{#each Object.entries(hitDice) as [die, { current, total }]}
				<div class="hit-die-row">
					<div class="hit-die-row__die-label">
						<span class="hit-die-row__die-size">d{die}</span>
						<span class="hit-die-row__available">{current} / {total}</span>
					</div>

					<div class="hit-die-row__controls">
						<button
							class="hit-die-row__button"
							onclick={() => decrementHitDie(die)}
							disabled={selectedHitDice[die] <= 0}
							aria-label="Decrease d{die}"
						>
							<i class="fa-solid fa-minus"></i>
						</button>

						<span class="hit-die-row__value">{selectedHitDice[die]}</span>

						<button
							class="hit-die-row__button"
							onclick={() => incrementHitDie(die)}
							disabled={selectedHitDice[die] >= current}
							aria-label="Increase d{die}"
						>
							<i class="fa-solid fa-plus"></i>
						</button>

						<button
							class="hit-die-row__button hit-die-row__button--max"
							onclick={() => maxHitDie(die)}
							disabled={selectedHitDice[die] >= current}
							aria-label="Max d{die}"
						>
							Max
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}>
		{#if totalSelected > 0}
			Rest & Spend {totalSelected} Hit {totalSelected === 1 ? 'Die' : 'Dice'}
		{:else}
			Rest Without Spending Hit Dice
		{/if}
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.field-rest-dialog {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1rem;

		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		&__heading {
			margin: 0;
			padding: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-medium-text-color);
			border: none;
		}

		&__rest-types {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.75rem;
		}
	}

	.rest-type-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-box-color);
		}

		&--active {
			border-color: hsl(0, 0%, 24%);
			background: hsla(0, 0%, 24%, 0.08);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);

			.rest-type-card--active & {
				color: hsl(0, 0%, 24%);
			}
		}

		&__title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__description {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1.45;
			color: var(--nimble-dark-text-color);
		}
	}

	.hit-dice-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.hit-die-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__die-label {
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
		}

		&__die-size {
			font-size: var(--nimble-md-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
		}

		&__available {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__controls {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__button {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-dark-text-color);
			background: var(--nimble-basic-button-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover:not(:disabled) {
				background: var(--nimble-box-color);
				color: var(--nimble-light-text-color);
			}

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			&--max {
				width: auto;
				padding: 0 0.5rem;
				font-weight: 600;
			}
		}

		&__value {
			min-width: 1.5rem;
			font-size: var(--nimble-md-text);
			font-weight: 600;
			text-align: center;
			color: var(--nimble-dark-text-color);
		}
	}
</style>
