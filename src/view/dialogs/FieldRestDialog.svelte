<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	function prepareFieldRestTypeTooltip() {
		return `
    <dl>
      <div>
        <dt>Catch Breath</dt>
        <dd>Requires at least 10 min to tend to your wounds. Expend any number of Hit Dice (roll them and add your STR to each), and regain that many HP.</dd>
      </div>

      <div>
        <dt>Make Camp</dt>
        <dd>If you rest for at least 8 hours with food and sleep, instead of rolling, take the maximum value of each Hit Die you expend (you still add your STR to each).</dd>
      </div>
    </dl>
  `;
	}

	function incrementHitDie(die: number) {
		selectedHitDice[die] = Math.min(selectedHitDice[die] + 1, hitDice[die].total);
	}

	function submit() {
		dialog.submitDialog({
			makeCamp,
			selectedHitDice: { ...selectedHitDice },
		});
	}

	let { document: actor, dialog }: Props = $props();

	const hitDice = actor.HitDiceManager.bySize;

	let makeCamp = $state(false);
	let selectedHitDice = $state(Object.fromEntries(Object.keys(hitDice).map((die) => [die, 0])));
</script>

<article class="nimble-sheet__body">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				Field Rest Type

				<i
					class="nimble-field-rest-types__help fa-solid fa-circle-question"
					data-tooltip={prepareFieldRestTypeTooltip()}
					data-tooltip-class="nimble-tooltip nimble-tooltip--field-rest"
				></i>
			</h3>
		</header>

		<div class="nimble-field-rest-types">
			<label
				class="nimble-field-rest-types__button"
				class:nimble-field-rest-types__button--active={!makeCamp}
			>
				Catch Breath

				<input
					class="nimble-field-rest-types__input"
					type="radio"
					name="{actor.uuid}-field-rest-type"
					value={false}
					bind:group={makeCamp}
				/>
			</label>

			<label
				class="nimble-field-rest-types__button"
				class:nimble-field-rest-types__button--active={makeCamp}
			>
				Make Camp

				<input
					class="nimble-field-rest-types__input"
					type="radio"
					name="{actor.uuid}-field-rest-type"
					value={true}
					bind:group={makeCamp}
				/>
			</label>
		</div>
	</section>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Hit Dice Selection</h3>
		</header>

		{#each Object.entries(hitDice) as [die, { current: _current, total }]}
			<div class="nimble-hit-die">
				<button class="nimble-hit-die__button" onclick={() => incrementHitDie(Number(die))}>
					d{die}
				</button>

				<input
					style="grid-area: selected; text-align: center;"
					type="number"
					min="0"
					max={total}
					bind:value={selectedHitDice[die]}
				/>

				<span style="grid-area: separator;"> / </span>

				<span style="grid-area: available;">
					{total}
				</span>
			</div>
		{/each}
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}> Field Rest </button>
</footer>

<style lang="scss">
	.nimble-sheet__body {
		--nimble-sheet-body-padding-block-start: 0.5rem;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.nimble-hit-die {
		display: grid;
		grid-template-columns: max-content 1fr min-content 1fr;
		grid-template-areas: 'die selected separator available';
		align-items: center;
		justify-items: center;
		gap: 0.75rem;

		&__button {
			grid-area: die;
			margin-inline: 0.75rem 0.5rem;
		}
	}

	.nimble-field-rest-types {
		display: flex;
		gap: 0.5rem;
		margin-block-end: 0.75rem;
		font-size: var(--nimble-sm-text);
		font-weight: 500;

		&__button {
			display: flex;
			align-self: center;
			justify-content: center;
			gap: 0.5rem;
			width: fit-content;
			padding: 0.5rem 1rem;
			line-height: 1;
			border: 1px solid black;
			border-radius: 4px;
			box-shadow: var(--nimble-card-box-shadow);
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&--active {
				color: var(--nimble-light-text-color);
				background: hsl(0, 0%, 24%);
			}
		}

		&__help {
			font-size: var(--nimble-xs-text);
		}

		&__input {
			display: none;
		}
	}
</style>
