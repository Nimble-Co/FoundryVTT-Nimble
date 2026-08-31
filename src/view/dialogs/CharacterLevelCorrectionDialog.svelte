<script lang="ts">
	import type { CharacterLevelCorrectionDialogProps } from '#types/components/CharacterLevelCorrectionDialog.d.ts';

	import FeatureGroupSelection from './components/characterCreator/FeatureGroupSelection.svelte';
	import Hint from '../components/Hint.svelte';
	import localize from '#utils/localize.js';
	import { createLevelCorrectionState } from './CharacterLevelCorrectionDialogState.svelte.ts';

	let { gaps, dialog }: CharacterLevelCorrectionDialogProps = $props();

	const { forms } = CONFIG.NIMBLE;

	const state = createLevelCorrectionState(
		() => gaps,
		() => dialog,
	);

	const groups = $derived(state.groups);
	const isComplete = $derived(state.isComplete);
</script>

<section class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.75rem;">
	<Hint
		hintText={localize('NIMBLE.levelCorrectionDialog.hint')}
		hintIcon="fa-solid fa-triangle-exclamation"
		hintType="warning"
	/>

	{#each groups as { gap, group } (gap.poolKey)}
		<section class="level-correction-gap">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.levelCorrectionDialog.gapHeading', { level: String(gap.level) })}
			</h3>

			{#if gap.optionLabel}
				<span class="level-correction-gap__label">{gap.optionLabel}</span>
			{/if}

			<FeatureGroupSelection
				groupName={gap.poolKey}
				{group}
				selectedFeatures={state.getSelectedFeatures(gap.poolKey)}
				onSelect={(feature) => state.toggleFeature(gap.poolKey, feature)}
			/>
		</section>
	{/each}
</section>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		aria-label={isComplete ? forms.submit : localize('NIMBLE.levelUpDialog.completeAllSelections')}
		data-tooltip={isComplete ? '' : localize('NIMBLE.levelUpDialog.completeAllSelections')}
		onclick={state.submit}
		disabled={!isComplete}
	>
		{forms.submit}
	</button>
</footer>

<style lang="scss">
	.level-correction-gap {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 0.25rem 0;
		}

		&__label {
			font-size: 0.875rem;
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.nimble-button[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
