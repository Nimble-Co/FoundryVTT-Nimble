<script lang="ts">
	import type { ClassFeatureSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';
	import type { NimbleFeatureItem } from '#documents/item/feature.js';

	import { getContext } from 'svelte';

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

	let hasAutoGrant = $derived((classFeatures?.autoGrant?.length ?? 0) > 0);
	let hasSelectionGroups = $derived((classFeatures?.selectionGroups?.size ?? 0) > 0);
	let hasAnyFeatures = $derived(hasAutoGrant || hasSelectionGroups);

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
			// Deselect if clicking the same feature
			newSelections.delete(groupName);
		} else {
			newSelections.set(groupName, feature);
		}
		selectedFeatures = newSelections;
	}

	function clearSelections() {
		selectedFeatures = new Map();
	}
</script>

{#if hasAnyFeatures}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.CLASS_FEATURES}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.classFeatureSelection.header')}

				{#if !active && hasSelectionGroups}
					<button
						class="nimble-button"
						data-button-variant="icon"
						aria-label={localize('NIMBLE.classFeatureSelection.editSelection')}
						data-tooltip={localize('NIMBLE.classFeatureSelection.editSelection')}
						onclick={clearSelections}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</h3>
		</header>

		{#if active}
			<Hint hintText={localize('NIMBLE.classFeatureSelection.hint')} />
		{/if}

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
	.granted-features__list {
		display: flex;
		flex-direction: column;
		margin: 0.5rem 0 0 0;
		padding: 0;
	}
</style>
