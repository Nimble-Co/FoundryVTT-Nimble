<script lang="ts">
	import type { NimbleCharacter } from '../../../../documents/actor/character.js';
	import type { NimbleClassItem } from '../../../../documents/item/class.js';
	import { incrementDieSize } from '../../../../managers/HitDiceManager.js';

	interface Props {
		document: NimbleCharacter;
		hitPointRollSelection: string;
	}

	let { document, hitPointRollSelection = $bindable() }: Props = $props();

	const characterClass: NimbleClassItem | undefined = document?.classes
		? (Object.values(document.classes)[0] as NimbleClassItem | undefined)
		: undefined;

	const baseHitDieSize = characterClass?.system?.hitDieSize ?? 6;
	const hitDiceSizeBonus =
		(document?.system?.attributes as { hitDiceSizeBonus?: number } | undefined)?.hitDiceSizeBonus ??
		0;
	const effectiveHitDieSize = incrementDieSize(baseHitDieSize, hitDiceSizeBonus);
	const averageHp = Math.ceil((effectiveHitDieSize + 1) / 2);
</script>

<section>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">HP Increase</h3>
	</header>

	<div class="nimble-hit-point-selection">
		<div class="nimble-hit-point-selection__hit-dice">
			<span class="nimble-hit-point-selection__hit-dice-label">Hit Dice:</span>
			<span class="nimble-hit-point-selection__die-box">d{effectiveHitDieSize}</span>
		</div>

		<div class="nimble-hit-point-selection__options">
			<label
				class="nimble-hit-point-selection__option"
				class:nimble-hit-point-selection__option--selected={hitPointRollSelection === 'roll'}
				data-tooltip="Roll your Hit Die with advantage and increase your max HP by that much."
			>
				<i class="fa-solid fa-dice"></i>
				Roll Hit Dice

				<input
					class="nimble-hit-point-selection__input"
					type="radio"
					name="{document.id}-hit-points"
					value="roll"
					bind:group={hitPointRollSelection}
				/>
			</label>

			<label
				class="nimble-hit-point-selection__option"
				class:nimble-hit-point-selection__option--selected={hitPointRollSelection === 'average'}
			>
				<i class="fa-solid fa-gauge"></i>
				Take Average ({averageHp})

				<input
					class="nimble-hit-point-selection__input"
					type="radio"
					name="{document.id}-hit-points"
					value="average"
					bind:group={hitPointRollSelection}
				/>
			</label>
		</div>
	</div>
</section>

<style lang="scss">
	.nimble-hit-point-selection {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-block-end: 0.75rem;
		font-size: var(--nimble-sm-text);
		font-weight: 500;

		&__hit-dice {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__hit-dice-label {
			font-weight: 500;
		}

		&__die-box {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 2.25rem;
			height: 2.25rem;
			padding: 0.25rem 0.5rem;
			font-size: 0.9em;
			font-weight: 700;
			border: 1px solid currentColor;
			border-radius: 5px;
			opacity: 0.7;
		}

		&__options {
			display: flex;
			gap: 0.5rem;
		}

		&__option {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			width: fit-content;
			padding: 0.5rem 1rem;
			line-height: 1;
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 4px;
			box-shadow: var(--nimble-card-box-shadow);
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover:not(&--selected) {
				background: var(--nimble-hint-background-color);
			}

			&--selected {
				color: var(--nimble-navigation-active-text-color);
				background: #842c2b;
				border-color: var(--nimble-input-border-color);
			}
		}

		&__input {
			display: none;
		}
	}
</style>
