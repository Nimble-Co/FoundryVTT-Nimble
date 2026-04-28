<script lang="ts">
	import type { LevelUpClassFeatureSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import FeatureCard from '../characterCreator/FeatureCard.svelte';
	import FeatureGroupSelection from '../characterCreator/FeatureGroupSelection.svelte';
	import Hint from '../../../components/Hint.svelte';
	import localize from '#utils/localize.js';
	import { createClassFeatureSelectionState } from './LevelUpClassFeatureSelection.svelte.ts';

	let {
		classFeatures,
		selectedFeatures = $bindable(),
		loading = false,
	}: LevelUpClassFeatureSelectionProps = $props();

	const state = createClassFeatureSelectionState(
		() => classFeatures,
		() => selectedFeatures,
		(features) => {
			selectedFeatures = features;
		},
	);

	const { handleFeatureSelect } = state;
	const hasAnyFeatures = $derived(state.hasAnyFeatures);
	const hasAutoGrant = $derived(state.hasAutoGrant);
	const hasSelectionGroups = $derived(state.hasSelectionGroups);
</script>

{#if loading}
	<section class="level-up-class-features">
		<header>
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.classFeatureSelection.header')}
			</h3>
		</header>
		<p class="nimble-hint">{localize('NIMBLE.levelUpDialog.loadingFeatures')}</p>
	</section>
{:else if hasAnyFeatures}
	<section class="level-up-class-features">
		<header>
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.classFeatureSelection.header')}
			</h3>
		</header>

		<Hint hintText={localize('NIMBLE.levelUpDialog.featuresHint')} />

		{#if hasAutoGrant}
			<ul class="granted-features__list">
				{#each classFeatures?.autoGrant ?? [] as feature (feature.uuid)}
					<FeatureCard {feature} />
				{/each}
			</ul>
		{/if}

		{#if hasSelectionGroups}
			{#each [...(classFeatures?.selectionGroups ?? [])] as [groupName, group] (groupName)}
				<FeatureGroupSelection
					{groupName}
					features={group.features}
					selectionCount={group.selectionCount}
					selectedFeatures={selectedFeatures.get(groupName) ?? []}
					onSelect={(feature) => handleFeatureSelect(groupName, feature)}
				/>
			{/each}
		{/if}
	</section>
{/if}

<style lang="scss">
	.level-up-class-features {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 1rem 0;
		}
	}

	.granted-features__list {
		display: flex;
		flex-direction: column;
		margin: 0.5rem 0 0 0;
		padding: 0;
	}
</style>
