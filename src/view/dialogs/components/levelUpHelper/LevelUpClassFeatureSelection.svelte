<script lang="ts">
	import type { LevelUpClassFeatureSelectionProps } from '#types/components/ClassFeatureSelection.d.ts';

	import DuplicateSourceGroup from '../characterCreator/DuplicateSourceGroup.svelte';
	import FeatureCard from '../characterCreator/FeatureCard.svelte';
	import FeatureGroupSelection from '../characterCreator/FeatureGroupSelection.svelte';
	import Hint from '../../../components/Hint.svelte';
	import localize from '#utils/localize.js';
	import { isRangeGroup } from '../../selectionGroupRules.ts';
	import { createClassFeatureSelectionState } from './LevelUpClassFeatureSelection.svelte.ts';
	import LevelUpFeatureOptionPicker from './LevelUpFeatureOptionPicker.svelte';

	let {
		classFeatures,
		levelingTo,
		selectedFeatures = $bindable(),
		selectedOptionIds = $bindable(),
		selectedOptionSubItems = $bindable(),
		ownedItemUuids,
		classFeatureIndex,
		loading = false,
	}: LevelUpClassFeatureSelectionProps = $props();

	const state = createClassFeatureSelectionState(
		() => classFeatures,
		() => selectedFeatures,
		(features) => {
			selectedFeatures = features;
		},
		() => selectedOptionIds,
		(ids) => {
			selectedOptionIds = ids;
		},
		() => selectedOptionSubItems,
		(items) => {
			selectedOptionSubItems = items;
		},
	);

	const { handleFeatureSelect, handleGroupSelectionSet, handleOptionSelect, handleSubItemSelect } =
		state;
	const hasAnyFeatures = $derived(state.hasAnyFeatures);
	const hasAutoGrant = $derived(state.hasAutoGrant);
	const hasSelectionGroups = $derived(state.hasSelectionGroups);
	const hasOptionFeatures = $derived(state.hasOptionFeatures);
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

		{#if hasOptionFeatures}
			{#each classFeatures?.optionFeatures ?? [] as feature (feature.uuid)}
				<LevelUpFeatureOptionPicker
					{feature}
					{levelingTo}
					selectedOptionId={selectedOptionIds.get(feature.uuid) ?? null}
					selectedSubItemUuids={selectedOptionSubItems.get(feature.uuid) ?? []}
					{ownedItemUuids}
					{classFeatureIndex}
					onSelect={(optionId) => handleOptionSelect(feature.uuid, optionId)}
					onSubItemSelect={(uuid) => handleSubItemSelect(feature.uuid, uuid)}
				/>
			{/each}
		{/if}

		{#if hasSelectionGroups}
			{#each [...(classFeatures?.selectionGroups ?? [])] as [groupName, group] (groupName)}
				<!-- A range group is a duplicate-source cluster: same feature, several places. -->
				{#if isRangeGroup(group)}
					<DuplicateSourceGroup
						{groupName}
						{group}
						selectedFeatures={selectedFeatures.get(groupName) ?? []}
						onSetSelection={(features) => handleGroupSelectionSet(groupName, features)}
					/>
				{:else}
					<FeatureGroupSelection
						{groupName}
						{group}
						selectedFeatures={selectedFeatures.get(groupName) ?? []}
						onSelect={(feature) => handleFeatureSelect(groupName, feature)}
					/>
				{/if}
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
