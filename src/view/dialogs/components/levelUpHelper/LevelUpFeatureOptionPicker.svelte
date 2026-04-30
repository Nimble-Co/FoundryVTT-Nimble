<script lang="ts">
	import type { LevelUpFeatureOptionPickerProps } from '#types/components/ClassFeatureSelection.d.ts';
	import type { NimbleFeatureItem } from '#documents/item/feature.js';

	import FeatureGroupSelection from '../characterCreator/FeatureGroupSelection.svelte';
	import localize from '#utils/localize.js';

	let {
		feature,
		levelingTo,
		selectedOptionId,
		selectedSubItemUuid,
		ownedItemUuids,
		onSelect,
		onSubItemSelect,
	}: LevelUpFeatureOptionPickerProps = $props();

	const options = $derived(
		(feature.system.levelUpOptions ?? []).filter(
			(opt) => opt.applyAtLevels.length === 0 || opt.applyAtLevels.includes(levelingTo),
		),
	);
	const selectedOption = $derived(options.find((o) => o.id === selectedOptionId) ?? null);
	const hasSubSelection = $derived((selectedOption?.selectionGroups?.length ?? 0) > 0);
	const isSelectionComplete = $derived(
		selectedOptionId !== null && (!hasSubSelection || selectedSubItemUuid !== null),
	);

	let loadedSubItems = $state<NimbleFeatureItem[]>([]);
	let subItemsLoading = $state(false);

	$effect(() => {
		const option = selectedOption;
		const owned = ownedItemUuids;
		const classId = feature.system.class;

		if (!option?.selectionGroups?.length) {
			loadedSubItems = [];
			subItemsLoading = false;
			return;
		}

		const groupSet = new Set(option.selectionGroups);
		subItemsLoading = true;

		(async () => {
			const results: NimbleFeatureItem[] = [];
			const seenUuids = new Set<string>();
			const indexFields = ['system.class', 'system.group', 'system.subclass'] as string[];

			for (const pack of game.packs) {
				if (pack.documentName !== 'Item') continue;
				// @ts-expect-error - custom index fields
				const packIndex = await pack.getIndex({ fields: indexFields });
				for (const entry of packIndex) {
					const e = entry as {
						uuid: string;
						type: string;
						system?: { class?: string; group?: string; subclass?: boolean };
					};
					if (e.type !== 'feature') continue;
					if (e.system?.class !== classId) continue;
					if (e.system?.subclass) continue;
					if (!groupSet.has(e.system?.group ?? '')) continue;
					if (seenUuids.has(e.uuid)) continue;
					seenUuids.add(e.uuid);
					const item = await fromUuid(e.uuid as `Item.${string}`);
					if (item) results.push(item as NimbleFeatureItem);
				}
			}

			loadedSubItems = results.filter((item) => !owned.has(item.uuid));
			subItemsLoading = false;
		})().catch(() => {
			subItemsLoading = false;
		});
	});

	const selectedSubItem = $derived(
		loadedSubItems.find((i) => i.uuid === selectedSubItemUuid) ?? null,
	);
</script>

<div class="feature-option-picker">
	<header class="feature-option-picker__header">
		<img
			class="feature-option-picker__img"
			src={feature.img || 'icons/svg/item-bag.svg'}
			alt={feature.name}
		/>
		<h4 class="nimble-heading feature-option-picker__name" data-heading-variant="section">
			{feature.name}
		</h4>
		{#if !isSelectionComplete}
			<span class="feature-option-picker__hint">
				{localize('NIMBLE.classFeatureSelection.chooseOne')}
			</span>
		{/if}
	</header>

	<ul class="feature-option-picker__list">
		{#each options as option (option.id)}
			{@const isSelected = selectedOptionId === option.id}
			<li class="option-item" class:selected={isSelected}>
				<button
					class="option-item__button"
					type="button"
					aria-pressed={isSelected}
					aria-label={isSelected
						? localize('NIMBLE.levelUpDialog.deselectOption')
						: localize('NIMBLE.levelUpDialog.selectOption')}
					onclick={() => onSelect(option.id)}
				>
					<span class="option-item__indicator">
						{#if isSelected}
							<i class="fa-solid fa-circle-check"></i>
						{:else}
							<i class="fa-regular fa-circle"></i>
						{/if}
					</span>
					<span class="option-item__label">{option.label}</span>
				</button>
			</li>
		{/each}
	</ul>

	{#if hasSubSelection && selectedOptionId}
		{#if subItemsLoading}
			<p class="nimble-hint sub-items-loading">
				{localize('NIMBLE.levelUpDialog.loadingFeatures')}
			</p>
		{:else if loadedSubItems.length > 0}
			<FeatureGroupSelection
				groupName="combat-abilities"
				features={loadedSubItems}
				selectionCount={1}
				selectedFeatures={selectedSubItem ? [selectedSubItem] : []}
				onSelect={(item) => onSubItemSelect(item.uuid)}
			/>
		{/if}
	{/if}
</div>

<style lang="scss">
	.feature-option-picker {
		margin-top: 1rem;

		&__header {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			margin-bottom: 0.5rem;
		}

		&__img {
			width: 32px;
			height: 32px;
			border-radius: 4px;
			object-fit: cover;
			flex-shrink: 0;
		}

		&__name {
			flex: 1;
			margin: 0;
		}

		&__hint {
			font-size: 0.875rem;
			font-weight: normal;
			color: var(--nimble-medium-text-color);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			margin: 0;
			padding: 0;
		}
	}

	.sub-items-loading {
		margin-top: 0.5rem;
	}

	.option-item {
		list-style: none;

		&__button {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			width: 100%;
			padding: 0.5rem 0.75rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			text-align: left;
			transition: all 0.2s ease;

			&:hover {
				border-color: var(--nimble-accent-color);
			}
		}

		&.selected .option-item__button {
			border-color: var(--nimble-accent-color);
			background: color-mix(
				in srgb,
				var(--nimble-accent-color) 10%,
				var(--nimble-box-background-color)
			);
		}

		&__indicator {
			font-size: 1rem;
			color: var(--nimble-accent-color);
			flex-shrink: 0;
			width: 1rem;
			text-align: center;
		}

		&__label {
			font-size: 0.9rem;
			line-height: 1.3;
		}
	}
</style>
