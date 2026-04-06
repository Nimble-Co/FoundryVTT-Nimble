<script lang="ts">
	import type { NimbleFeatureItem } from '#documents/item/feature.js';
	import type { LevelUpClassFeatureSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import FeatureCard from '../characterCreator/FeatureCard.svelte';
	import FeatureGroupSelection from '../characterCreator/FeatureGroupSelection.svelte';
	import Hint from '../../../components/Hint.svelte';
	import localize from '#utils/localize.js';

	let {
		classFeatures,
		selectedFeatures = $bindable(),
		loading = false,
	}: LevelUpClassFeatureSelectionProps = $props();

	// Auto-select features for groups that only have one option
	$effect(() => {
		if (!classFeatures?.selectionGroups) return;

		const newSelections = new Map(selectedFeatures);
		let hasChanges = false;

		for (const [groupName, features] of classFeatures.selectionGroups) {
			if (features.length === 1 && !newSelections.has(groupName)) {
				newSelections.set(groupName, features[0]);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			selectedFeatures = newSelections;
		}
	});

	function handleFeatureSelect(groupName: string, feature: NimbleFeatureItem) {
		const newSelections = new Map(selectedFeatures);

		if (newSelections.get(groupName)?.uuid === feature.uuid) {
			newSelections.delete(groupName);
		} else {
			newSelections.set(groupName, feature);
		}

		selectedFeatures = newSelections;
	}

	const hasAutoGrant = $derived((classFeatures?.autoGrant?.length ?? 0) > 0);
	const hasSelectionGroups = $derived((classFeatures?.selectionGroups?.size ?? 0) > 0);
	const hasAnyFeatures = $derived(hasAutoGrant || hasSelectionGroups);
</script>

{#if loading}
	<section class="level-up-class-features">
		<header>
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.classFeatureSelection.header')}
			</h3>
		</header>
		<p class="nimble-hint">Loading features...</p>
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
			{#each [...(classFeatures?.selectionGroups ?? [])] as [groupName, features] (groupName)}
				<FeatureGroupSelection
					{groupName}
					{features}
					selectedFeature={selectedFeatures.get(groupName) ?? null}
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
