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
		hintText,
	}: ClassFeatureSelectionProps = $props();

	// These contexts are provided by the character creation dialog so the section
	// can participate in its stage scroll-tracking. In other hosts (e.g. the level-up
	// dialog) the contexts are undefined and we fall back to neutral id generation.
	const CHARACTER_CREATION_STAGES = getContext<Record<string, string | number> | undefined>(
		'CHARACTER_CREATION_STAGES',
	) ?? {
		CLASS_FEATURES: 'class-features',
	};
	const dialog = getContext<{ id: string } | undefined>('dialog') ?? { id: 'class-features' };

	const state = createClassFeatureSelectionState(
		() => ({ classFeatures, selectedFeatures }),
		(features) => (selectedFeatures = features),
	);

	const resolvedHintText = $derived(hintText ?? localize('NIMBLE.classFeatureSelection.hint'));
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
			<Hint hintText={resolvedHintText} />
		{/if}

		{#if state.hasAutoGrant}
			<ul class="granted-features__list">
				{#each classFeatures?.autoGrant ?? [] as feature (feature.uuid)}
					<FeatureCard {feature} />
				{/each}
			</ul>
		{/if}

		{#if state.hasSelectionGroups}
			{#each [...(classFeatures?.selectionGroups ?? [])] as [groupName, group] (groupName)}
				<FeatureGroupSelection
					{groupName}
					features={group.features}
					selectionCount={group.selectionCount}
					selectedFeatures={selectedFeatures.get(groupName) ?? []}
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
