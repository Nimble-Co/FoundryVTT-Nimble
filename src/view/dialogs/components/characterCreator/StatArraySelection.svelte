<script>
	import { getContext } from 'svelte';
	import generateBlankAttributeSet from '../../../../utils/generateBlankAttributeSet.js';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	import Hint from '../../../components/Hint.svelte';

	function toggleArray(selection) {
		selectedArray = selection;

		selectedAbilityScores = generateBlankAttributeSet();
		bonusLanguages = [];
	}

	let {
		active,
		bonusLanguages = $bindable(),
		selectedAbilityScores = $bindable(),
		selectedArray = $bindable(),
		statArrayOptions,
	} = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const hintText =
		"Select one of the following stat arrays used to determine your character's core statistics. You can assign these values to specific attributes in the next step.";
</script>

<section id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ARRAY}">
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">Step 4. Select Stat Array</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		<ul class="stat-arrays">
			{#each statArrayOptions as arrayOption}
				<li class="stat-arrays__option">
					<button class="stat-array" onclick={() => toggleArray(arrayOption)}>
						<h4 class="nimble-heading" data-heading-variant="section">
							{arrayOption.name}
						</h4>

						<ul class="nimble-array-terms">
							{#each arrayOption.array as modifier}
								<li class="nimble-array-terms__value">
									{replaceHyphenWithMinusSign(modifier)}
								</li>
							{/each}
						</ul>
					</button>
				</li>
			{/each}
		</ul>
	{:else if selectedArray}
		<ul class="stat-arrays">
			<li class="stat-arrays__option">
				<button
					class="stat-array stat-array--selected"
					data-tooltip="Edit Stat Array"
					onclick={() => toggleArray(null)}
				>
					<h4 class="nimble-heading" data-heading-variant="section">
						{selectedArray.name}
					</h4>

					<ul class="nimble-array-terms">
						{#each selectedArray.array as modifier}
							<li class="nimble-array-terms__value">
								{replaceHyphenWithMinusSign(modifier)}
							</li>
						{/each}
					</ul>
				</button>
			</li>
		</ul>
	{/if}
</section>

<style lang="scss">
	.nimble-array-terms {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(1rem, 1fr));
		gap: 0.5rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		line-height: 1;

		&__value {
			padding: 0.125rem 0.25rem;
			border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
			border-radius: 4px;
			box-shadow: var(--nimble-box-shadow);
		}
	}

	.stat-array {
		--button-size: fit-content;

		display: flex;
		flex-direction: column;
		padding: 0;
		margin: 0;
		overflow: hidden;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-card-background-color, unset);
		border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		transition: var(--nimble-standard-transition);

		gap: 0.75rem;
		padding: 0.75rem 1rem;

		&:hover {
			color: var(--nimble-dark-text-color);
			background: var(--nimble-card-background-color, unset);
			border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
			transform: translateY(-2px);
		}

		&--selected:hover {
			transform: none;
		}
	}

	.stat-arrays {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;

		&__option {
			display: contents;
		}
	}
</style>
