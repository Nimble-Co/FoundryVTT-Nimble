<script lang="ts">
	import type { ClassFeatureSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import { getContext } from 'svelte';

	import { createClassFeatureSelectionState } from './ClassFeatureSelection.svelte.ts';
	import FeatureCard from './FeatureCard.svelte';
	import FeatureGroupSelection from './FeatureGroupSelection.svelte';
	import Hint from '../../../components/Hint.svelte';
	import localize from '#utils/localize.js';

	let {
		active,
		classFeatures,
		selectedFeatures = $bindable(),
	}: ClassFeatureSelectionProps = $props();

	const CHARACTER_CREATION_STAGES = getContext<Record<string, string | number>>(
		'CHARACTER_CREATION_STAGES',
	);
	const dialog = getContext<{ id: string }>('dialog');

	const state = createClassFeatureSelectionState(
		() => ({ classFeatures, selectedFeatures }),
		(features) => (selectedFeatures = features),
	);
</script>

{#if state.hasAnyFeatures}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.CLASS_FEATURES}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.classFeatureSelection.header')}
			</h3>
		</header>

		{#if active}
			<Hint hintText={localize('NIMBLE.classFeatureSelection.hint')} />
		{/if}

		{#if state.hasAutoGrant}
			<ul class="granted-features__list">
				{#each classFeatures?.autoGrant ?? [] as feature (feature.uuid)}
					<FeatureCard {feature} />
				{/each}
			</ul>
		{/if}

		{#if state.hasSelectionGroups}
			{#each [...(classFeatures?.selectionGroups ?? [])] as [groupName, features] (groupName)}
				<FeatureGroupSelection
					{groupName}
					{features}
					selectedFeature={selectedFeatures.get(groupName) ?? null}
					onSelect={(feature) => state.handleFeatureSelect(groupName, feature)}
				/>
			{/each}
		{/if}
	</section>
{/if}

<style lang="scss">
	.granted-features__list {
		display: flex;
		flex-direction: column;
		margin: 0.5rem 0 0 0;
		padding: 0;
	}
</style>
