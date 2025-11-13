<script>
	let { document, hitPointRollSelection = $bindable() } = $props();
</script>

<section>
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">Hit Points</h3>
	</header>

	<div class="nimble-hit-point-roll-selection">
		<label
			class="nimble-hit-point-roll-selection__option"
			class:nimble-hit-point-roll-selection__option--selected={hitPointRollSelection === 'roll'}
		>
			<i class="fa-solid fa-dice"></i>
			Roll Hit Points

			<input
				class="nimble-hit-point-roll-selection__input"
				type="radio"
				name="{document.id}-hit-points"
				value="roll"
				bind:group={hitPointRollSelection}
			/>
		</label>

		<label
			class="nimble-hit-point-roll-selection__option"
			class:nimble-hit-point-roll-selection__option--selected={hitPointRollSelection === 'average'}
		>
			<i class="fa-solid fa-gauge"></i>
			Take Average

			<input
				class="nimble-hit-point-roll-selection__input"
				type="radio"
				name="{document.id}-hit-points"
				value="average"
				bind:group={hitPointRollSelection}
			/>
		</label>
	</div>
</section>

<style lang="scss">
	.nimble-hit-point-roll-selection {
		display: flex;
		gap: 0.5rem;
		margin-block-end: 0.75rem;
		font-size: var(--nimble-sm-text);
		font-weight: 500;

		&__option {
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

			&--selected {
				color: var(--nimble-light-text-color);
				background: hsl(0, 0%, 24%);
			}
		}

		&__input {
			display: none;
		}
	}
</style>
