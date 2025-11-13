<script>
	import { getContext } from 'svelte';
	import generateBlankAttributeSet from '../../../../utils/generateBlankAttributeSet.js';
	import Hint from '../../../components/Hint.svelte';
	import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

	function handleAbilityModifierDrop(event, abilityKey) {
		const modifierIndex = Number.parseInt(event.dataTransfer.getData('modifier'), 10);

		const existingModifier = Object.entries(tempSelectedAbilityScores).find(
			([_, value]) => value === modifierIndex,
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

	const { abilityScores, abilityScoreTooltips, abilityScoreControls, characterCreationStages } =
		CONFIG.NIMBLE;
	const abilityScoreCount = Object.keys(abilityScores).length;
	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const hintText =
		'Below you will find the stat bonuses granted by your selected array. Drag and drop each of these values onto one of the attribute boxes below to assign your ability scores.';

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
		selectedAbilityScores;

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

		<ul class="nimble-ability-score-list" role="list">
			{#each Object.entries(tempSelectedAbilityScores) as [abilityKey, arrayIndex]}
				{@const savingThrowStatus = getSavingThrowStatus(abilityKey)}
				{@const isKey = isKeyAbility(abilityKey)}
				<li
					class="nimble-cc-ability-score"
					class:nimble-cc-ability-score--key={isKey}
					ondrop={(event) => handleAbilityModifierDrop(event, abilityKey)}
					data-tooltip={isKey ? abilityScoreTooltips.keyStat : null}
					data-tooltip-class="nimble-tooltip nimble-tooltip--key-ability"
					data-tooltip-direction="UP"
				>
					<div
						class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--top"
						class:nimble-cc-ability-score__indicator--advantage={savingThrowStatus === 'advantage'}
					>
						<i
							class="fa-solid fa-caret-up"
							data-tooltip={savingThrowStatus === 'advantage'
								? abilityScoreTooltips.advantageOnSave
								: null}
							data-tooltip-direction="UP"
						></i>
					</div>

					<header class="nimble-cc-ability-score__header">
						<h4 class="nimble-heading" data-heading-variant="section">
							{abilityScores[abilityKey]}
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
							{replaceHyphenWithMinusSign(selectedArray?.array?.[arrayIndex] ?? '')}
						</div>
					{:else}
						-
					{/if}

					<div
						class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--bottom"
						class:nimble-cc-ability-score__indicator--disadvantage={savingThrowStatus ===
							'disadvantage'}
					>
						<i
							class="fa-solid fa-caret-down"
							data-tooltip={savingThrowStatus === 'disadvantage'
								? abilityScoreTooltips.disadvantageOnSave
								: null}
							data-tooltip-direction="DOWN"
						></i>
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
							{replaceHyphenWithMinusSign(modifier)}
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
				<li
					class="nimble-cc-ability-score"
					class:nimble-cc-ability-score--key={isKey}
					data-tooltip={isKey ? abilityScoreTooltips.keyStat : null}
					data-tooltip-class="nimble-tooltip nimble-tooltip--key-ability"
					data-tooltip-direction="UP"
				>
					<div
						class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--top"
						class:nimble-cc-ability-score__indicator--advantage={savingThrowStatus === 'advantage'}
					>
						<i
							class="fa-solid fa-caret-up"
							data-tooltip={savingThrowStatus === 'advantage'
								? abilityScoreTooltips.advantageOnSave
								: null}
							data-tooltip-direction="UP"
						></i>
					</div>

					<header class="nimble-cc-ability-score__header">
						<h4 class="nimble-heading" data-heading-variant="section">
							{abilityScores[abilityKey]}
						</h4>
					</header>

					<div class="nimble-cc-ability-score__value nimble-cc-ability-score__value--no-drag">
						{replaceHyphenWithMinusSign(selectedArray?.array?.[arrayIndex] ?? '')}
					</div>

					<div
						class="nimble-cc-ability-score__indicator nimble-cc-ability-score__indicator--bottom"
						class:nimble-cc-ability-score__indicator--disadvantage={savingThrowStatus ===
							'disadvantage'}
					>
						<i
							class="fa-solid fa-caret-down"
							data-tooltip={savingThrowStatus === 'disadvantage'
								? abilityScoreTooltips.disadvantageOnSave
								: null}
							data-tooltip-direction="DOWN"
						></i>
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
		flex-direction: column;
		align-items: center;
		margin: 0;
		background: var(--nimble-card-background-color, unset);
		border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		border-radius: 4px;
		cursor: grab;
		font-size: var(--nimble-md-text);
	}

	.nimble-cc-ability-score {
		padding: 0.5rem;
		margin: 1rem 0;
		gap: 0.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--nimble-card-background-color, unset);
		border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));
		box-shadow: var(--nimble-box-shadow);
		border-radius: 4px;
		font-size: var(--nimble-md-text);
		cursor: auto;
		position: relative;

		&:hover {
			text-shadow: none;
		}

		&--key {
			border: 2px solid hsl(43, 50%, 45%);
			box-shadow: var(--nimble-box-shadow);
			background: linear-gradient(
				135deg,
				var(--nimble-card-background-color, hsl(0, 0%, 20%)) 0%,
				hsla(43, 30%, 20%, 0.3) 100%
			);
		}

		&__indicator {
			position: absolute;
			width: 100%;
			display: flex;
			justify-content: center;
			font-size: 2.25rem;
			line-height: 1;
			color: hsla(0, 0%, 50%, 0.3);
			transition:
				color 0.2s ease,
				text-shadow 0.2s ease;

			i {
				pointer-events: auto;
			}

			&--top {
				top: -1.25rem;
			}

			&--bottom {
				bottom: -1.25rem;
			}

			&--advantage {
				color: hsl(155, 45%, 48%);
				text-shadow: 0 0 8px hsla(155, 50%, 35%, 0.8);
			}

			&--disadvantage {
				color: hsl(355, 55%, 52%);
				text-shadow: 0 0 8px hsla(355, 50%, 38%, 0.8);
			}
		}

		&__value {
			width: 100%;
			text-align: center;
			cursor: grab;

			&--no-drag {
				cursor: auto;
			}
		}
	}

	:global(.nimble-tooltip--key-ability) {
		background: linear-gradient(135deg, hsl(43, 70%, 45%) 0%, hsl(43, 80%, 55%) 100%);
		border: 1px solid hsl(43, 90%, 65%);
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.6),
			0 0 12px hsla(43, 80%, 50%, 0.4);
		font-weight: 600;
		letter-spacing: 0.025em;
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}
</style>
