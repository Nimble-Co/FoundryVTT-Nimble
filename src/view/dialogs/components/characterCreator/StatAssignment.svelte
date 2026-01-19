<script>
	import { getContext } from 'svelte';
	import generateBlankAttributeSet from '../../../../utils/generateBlankAttributeSet.js';
	import Hint from '../../../components/Hint.svelte';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function formatModifier(value) {
		if (value === '' || value === null || value === undefined) return '';
		return replaceHyphenWithMinusSign(
			new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(value),
		);
	}

	function handleAbilityModifierDrop(event, abilityKey) {
		const modifierIndex = Number.parseInt(event.dataTransfer.getData('modifier'), 10);

		const existingModifier = Object.entries(tempSelectedAbilityScores).find(
			([, value]) => value === modifierIndex,
		);

		if (existingModifier) {
			const [previousKey] = existingModifier;

			tempSelectedAbilityScores[previousKey] = tempSelectedAbilityScores[abilityKey];
		}

		tempSelectedAbilityScores[abilityKey] = modifierIndex;
	}

	function lockInStatAssignment() {
		selectedAbilityScores = tempSelectedAbilityScores;
	}

	const {
		abilityScores,
		abilityScoreTooltips,
		abilityScoreControls,
		characterCreationStages,
		hints,
	} = CONFIG.NIMBLE;
	const abilityScoreCount = Object.keys(abilityScores).length;
	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const hintText = hints.statAssignment;

	let {
		active,
		bonusLanguages = $bindable(),
		selectedArray,
		selectedAbilityScores = $bindable(),
		selectedClass,
	} = $props();

	let tempSelectedAbilityScores = $state(generateBlankAttributeSet());

	let allStatsSelected = $derived(
		Object.values(tempSelectedAbilityScores).every((value) => value !== null),
	);

	let statsLockedIn = $derived(
		Object.values(selectedAbilityScores).every((value) => value !== null),
	);

	let keyAbilityScores = $derived(selectedClass?.system?.keyAbilityScores ?? []);
	let savingThrowAdvantage = $derived(selectedClass?.system?.savingThrows?.advantage ?? null);
	let savingThrowDisadvantage = $derived(selectedClass?.system?.savingThrows?.disadvantage ?? null);

	function isKeyAbility(abilityKey) {
		return keyAbilityScores.includes(abilityKey);
	}

	function getSavingThrowStatus(abilityKey) {
		if (abilityKey === savingThrowAdvantage) return 'advantage';
		if (abilityKey === savingThrowDisadvantage) return 'disadvantage';
		return null;
	}

	$effect(() => {
		// Reset temp assignments when `selectedArray` changes.
		void selectedArray;
		tempSelectedAbilityScores = generateBlankAttributeSet();
		bonusLanguages = [];
	});
</script>

<section
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.STATS}"
	style="--abilityScoreCount: {abilityScoreCount};"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			{characterCreationStages.stepFiveStats}

			{#if !active && !Object.values(selectedAbilityScores).some((mod) => mod === null)}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label={abilityScoreTooltips.editStats}
					data-tooltip={abilityScoreTooltips.editStats}
					onclick={() => (selectedAbilityScores = generateBlankAttributeSet())}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		<aside class="nimble-cc-legend">
			<div class="nimble-cc-legend__item">
				<i class="fa-solid fa-star nimble-cc-legend__icon--key"></i>
				<span>Key Stat</span>
			</div>
			<div class="nimble-cc-legend__item">
				<i class="fa-solid fa-circle-plus nimble-cc-legend__icon--advantage"></i>
				<span>Adv. on Saves</span>
			</div>
			<div class="nimble-cc-legend__item">
				<i class="fa-solid fa-circle-minus nimble-cc-legend__icon--disadvantage"></i>
				<span>Dis. on Saves</span>
			</div>
		</aside>

		<ul class="nimble-ability-score-list" role="list">
			{#each Object.entries(tempSelectedAbilityScores) as [abilityKey, arrayIndex]}
				{@const savingThrowStatus = getSavingThrowStatus(abilityKey)}
				{@const isKey = isKeyAbility(abilityKey)}
				<li
					class="nimble-cc-ability-score"
					ondrop={(event) => {
						event.currentTarget.classList.remove('nimble-cc-ability-score--drag-over');
						handleAbilityModifierDrop(event, abilityKey);
					}}
					ondragover={(event) => {
						event.preventDefault();
						event.currentTarget.classList.add('nimble-cc-ability-score--drag-over');
					}}
					ondragleave={(event) => {
						event.currentTarget.classList.remove('nimble-cc-ability-score--drag-over');
					}}
				>
					<header class="nimble-cc-ability-score__header">
						<h4 class="nimble-heading" data-heading-variant="section">
							{#if isKey}<span
									data-tooltip={abilityScoreTooltips.keyStat}
									data-tooltip-direction="UP"
									>{abilityScores[abilityKey]}<sup class="nimble-cc-ability-score__key-star"
										><i class="fa-solid fa-star"></i></sup
									></span
								>{:else}{abilityScores[abilityKey]}{/if}
						</h4>
					</header>

					{#if arrayIndex !== null}
						<div
							class="nimble-cc-ability-score__value"
							role="listitem"
							draggable="true"
							ondragstart={(e) => {
								e.dataTransfer.dropEffect = 'move';
								e.dataTransfer.setData('modifier', arrayIndex);
							}}
						>
							<i class="fa-solid fa-grip-vertical drag-icon"></i>
							<span>{formatModifier(selectedArray?.array?.[arrayIndex])}</span>
						</div>
					{:else}
						<div class="nimble-cc-ability-score__drop-zone">
							<i class="fa-solid fa-arrow-down drop-icon"></i>
							<span class="drop-text">Drop here</span>
						</div>
					{/if}

					<div class="nimble-cc-ability-score__indicators">
						{#if savingThrowStatus === 'advantage'}
							<i
								class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--advantage fa-solid fa-circle-plus"
								data-tooltip={abilityScoreTooltips.advantageOnSave}
								data-tooltip-direction="UP"
							></i>
						{:else if savingThrowStatus === 'disadvantage'}
							<i
								class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--disadvantage fa-solid fa-circle-minus"
								data-tooltip={abilityScoreTooltips.disadvantageOnSave}
								data-tooltip-direction="UP"
							></i>
						{/if}
					</div>
				</li>
			{/each}
		</ul>

		{#if !allStatsSelected}
			<ul class="nimble-array-value-list">
				{#each selectedArray?.array ?? [] as modifier, modifierIndex (modifierIndex)}
					{#if !Object.values(tempSelectedAbilityScores).includes(modifierIndex)}
						<li
							class="nimble-array-value-list__option"
							draggable="true"
							ondragstart={(e) => {
								e.dataTransfer.dropEffect = 'move';
								e.dataTransfer.setData('modifier', modifierIndex);
							}}
						>
							<i class="fa-solid fa-grip-vertical drag-icon"></i>
							<span class="modifier-value">{formatModifier(modifier)}</span>
						</li>
					{/if}
				{/each}
			</ul>
		{:else}
			<button
				class="nimble-button"
				data-button-variant="basic"
				type="button"
				onclick={lockInStatAssignment}
			>
				{abilityScoreControls.confirmStatAssignments}
			</button>
		{/if}
	{:else if statsLockedIn}
		<ul class="nimble-ability-score-list">
			{#each Object.entries(selectedAbilityScores) as [abilityKey, arrayIndex]}
				{@const savingThrowStatus = getSavingThrowStatus(abilityKey)}
				{@const isKey = isKeyAbility(abilityKey)}
				<li class="nimble-cc-ability-score">
					<header class="nimble-cc-ability-score__header">
						<h4 class="nimble-heading" data-heading-variant="section">
							{#if isKey}<span
									data-tooltip={abilityScoreTooltips.keyStat}
									data-tooltip-direction="UP"
									>{abilityScores[abilityKey]}<sup class="nimble-cc-ability-score__key-star"
										><i class="fa-solid fa-star"></i></sup
									></span
								>{:else}{abilityScores[abilityKey]}{/if}
						</h4>
					</header>

					<div class="nimble-cc-ability-score__value nimble-cc-ability-score__value--no-drag">
						{formatModifier(selectedArray?.array?.[arrayIndex])}
					</div>

					<div class="nimble-cc-ability-score__indicators">
						{#if savingThrowStatus === 'advantage'}
							<i
								class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--advantage fa-solid fa-circle-plus"
								data-tooltip={abilityScoreTooltips.advantageOnSave}
								data-tooltip-direction="UP"
							></i>
						{:else if savingThrowStatus === 'disadvantage'}
							<i
								class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--disadvantage fa-solid fa-circle-minus"
								data-tooltip={abilityScoreTooltips.disadvantageOnSave}
								data-tooltip-direction="UP"
							></i>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="scss">
	[data-button-variant='basic'] {
		--nimble-button-margin: 0.5rem 0 0 0;
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}

	.nimble-cc-legend {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
		padding: 0.375rem 0.5rem;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
		background: hsla(0, 0%, 0%, 0.03);
		border-radius: 4px;

		&__item {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		&__icon--key {
			font-size: 0.5rem;
			color: hsl(45, 90%, 55%);
		}

		&__icon--advantage {
			font-size: var(--nimble-sm-text);
			color: hsl(139, 48%, 36%);
		}

		&__icon--disadvantage {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-roll-failure-color, hsl(355, 55%, 52%));
		}
	}

	.nimble-array-value-list,
	.nimble-ability-score-list {
		display: grid;
		grid-template-columns: repeat(var(--abilityScoreCount, 5), 1fr);
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-array-value-list {
		margin-block-start: 0.5rem;
	}

	.nimble-array-value-list__option {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		position: relative;
		margin: 0;
		padding: 0.5rem;
		background-color: var(--nimble-box-background-color, var(--nimble-card-background-color));
		border: 2px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		border-radius: 4px;
		cursor: grab;
		font-size: var(--nimble-md-text);
		font-weight: 600;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-accent-color);
			box-shadow:
				var(--nimble-box-shadow),
				0 0 6px color-mix(in srgb, var(--nimble-accent-color) 50%, transparent);
			transform: scale(1.05);

			.drag-icon {
				opacity: 1;
			}
		}

		&:active {
			cursor: grabbing;
		}

		.drag-icon {
			position: absolute;
			left: 0.5rem;
			font-size: 0.75rem;
			opacity: 0.6;
			transition: opacity 0.2s ease;
		}

		.modifier-value {
			font-weight: 600;
		}
	}

	.nimble-cc-ability-score {
		padding: 0.5rem;
		margin: 0.5rem 0;
		gap: 0.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--nimble-card-background-color, unset);
		border: 2px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		border-radius: 4px;
		font-size: var(--nimble-md-text);
		cursor: auto;
		position: relative;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease,
			box-shadow 0.2s ease;

		&__key-star {
			font-size: 0.5rem;
			color: hsl(45, 90%, 55%);
			margin-left: 0.125rem;
		}

		&:hover {
			text-shadow: none;
		}

		&:global(.nimble-cc-ability-score--drag-over) {
			border-color: var(--nimble-card-border-color);
			background: color-mix(
				in srgb,
				var(--nimble-card-border-color) 15%,
				var(--nimble-card-background-color, transparent)
			);
			box-shadow:
				var(--nimble-box-shadow),
				0 0 8px color-mix(in srgb, var(--nimble-card-border-color) 40%, transparent);
		}

		&__indicators {
			display: flex;
			gap: 0.25rem;
			align-items: center;
			justify-content: center;
			min-height: 1rem;
		}

		&__indicator {
			font-size: var(--nimble-sm-text);
			transition: color 0.2s ease;

			&--advantage {
				color: hsl(139, 48%, 36%);
			}

			&--disadvantage {
				color: var(--nimble-roll-failure-color, hsl(355, 55%, 52%));
			}
		}

		&__drop-zone {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.125rem;
			width: 100%;
			padding: 0.25rem;
			border: 2px dashed var(--nimble-card-border-color, hsl(41, 18%, 54%));
			border-radius: 4px;
			opacity: 0.4;
			transition: var(--nimble-standard-transition);

			.drop-icon {
				font-size: 0.75rem;
			}

			.drop-text {
				font-size: 0.625rem;
				text-transform: uppercase;
				letter-spacing: 0.05em;
			}
		}

		&:global(.nimble-cc-ability-score--drag-over) &__drop-zone {
			opacity: 1;
			border-color: var(--nimble-card-border-color);
			background-color: color-mix(in srgb, var(--nimble-card-border-color) 20%, transparent);
			animation: pulse 1s ease-in-out infinite;
		}

		@keyframes pulse {
			0%,
			100% {
				transform: scale(1);
			}
			50% {
				transform: scale(1.05);
			}
		}

		&__value {
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;
			width: 100%;
			padding: 0.25rem;
			text-align: center;
			cursor: grab;
			font-weight: 600;
			background-color: var(--nimble-box-background-color, var(--nimble-card-background-color));
			border-radius: 4px;

			.drag-icon {
				position: absolute;
				left: 0.25rem;
				font-size: 0.625rem;
				opacity: 0.5;
				transition: opacity 0.2s ease;
			}

			&:hover {
				background-color: color-mix(
					in srgb,
					var(--nimble-card-border-color) 20%,
					var(--nimble-box-background-color, transparent)
				);

				.drag-icon {
					opacity: 1;
				}
			}

			&--no-drag {
				cursor: auto;
				background-color: transparent;

				&:hover {
					background-color: transparent;
				}
			}
		}
	}
</style>
