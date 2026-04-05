<script lang="ts">
	import type { NimbleClassItem } from '#documents/item/class.js';
	import type { NimbleFeatureItem } from '#documents/item/feature.js';
	import type {
		AbilityScoreDataEntry,
		ClassProgressionLevelData,
		SubclassChoice,
	} from '#types/components/ClassProgressionTab.d.ts';

	import ClassProgressionLevelRow from '../components/ClassProgressionLevelRow.svelte';
	import getClassProgressionData from '../../../utils/getClassProgressionData.js';
	import getSubclassChoices from '../../../utils/getSubclassChoices.js';
	import localize from '../../../utils/localize.js';

	import { getContext } from 'svelte';

	const SUBCLASS_LEVELS = [3, 7, 11, 15] as const;
	const ABILITY_SCORE_LEVELS = [4, 5, 8, 9, 12, 13, 16, 17, 20] as const;

	let item: NimbleClassItem = getContext('document');

	let progressionData = $state<Map<number, ClassProgressionLevelData>>(new Map());
	let subclasses = $state<SubclassChoice[]>([]);
	let isLoading = $state(true);
	let expandedGroups = $state<Set<string>>(new Set());
	let expandedSubclasses = $state<Set<string>>(new Set());

	const identifier = $derived(item.reactive.system.identifier);
	const groupIdentifiers = $derived(item.reactive.system.groupIdentifiers || []);
	const abilityScoreData = $derived(item.reactive.system.abilityScoreData);
	const keyAbilityScores = $derived(item.reactive.system.keyAbilityScores || []);

	// Collect all unique selection groups across all levels
	const selectionGroups = $derived.by(() => {
		const groups = new Map<string, NimbleFeatureItem[]>();
		for (const [, levelData] of progressionData) {
			for (const [groupName, features] of levelData.selectionGroups) {
				if (!groups.has(groupName)) {
					groups.set(groupName, []);
				}
				// Add features we haven't seen yet
				const existing = groups.get(groupName)!;
				for (const feature of features) {
					if (!existing.some((f) => f.uuid === feature.uuid)) {
						existing.push(feature);
					}
				}
			}
		}
		return groups;
	});

	// Get levels where a selection group is available
	function getGroupLevels(groupName: string): number[] {
		const levels: number[] = [];
		for (const [level, levelData] of progressionData) {
			if (levelData.selectionGroups.has(groupName)) {
				levels.push(level);
			}
		}
		return levels.sort((a, b) => a - b);
	}

	// Create level data without selection groups (for level rows)
	function getLevelDataWithoutSelections(level: number): ClassProgressionLevelData {
		const data = progressionData.get(level);
		if (!data) {
			return { autoGrant: [], selectionGroups: new Map() };
		}
		// Return data with empty selectionGroups - they're shown consolidated at bottom
		return {
			autoGrant: data.autoGrant,
			selectionGroups: new Map(),
		};
	}

	function toggleGroup(groupName: string): void {
		if (expandedGroups.has(groupName)) {
			expandedGroups.delete(groupName);
			expandedGroups = new Set(expandedGroups);
		} else {
			expandedGroups.add(groupName);
			expandedGroups = new Set(expandedGroups);
		}
	}

	function isGroupExpanded(groupName: string): boolean {
		return expandedGroups.has(groupName);
	}

	function toggleSubclass(uuid: string): void {
		if (expandedSubclasses.has(uuid)) {
			expandedSubclasses.delete(uuid);
			expandedSubclasses = new Set(expandedSubclasses);
		} else {
			expandedSubclasses.add(uuid);
			expandedSubclasses = new Set(expandedSubclasses);
		}
	}

	function isSubclassExpanded(uuid: string): boolean {
		return expandedSubclasses.has(uuid);
	}

	async function loadProgressionData(): Promise<void> {
		if (!identifier) return;

		isLoading = true;

		const [progression, subclassChoices] = await Promise.all([
			getClassProgressionData(identifier, groupIdentifiers),
			getSubclassChoices(identifier),
		]);

		progressionData = progression;
		subclasses = subclassChoices;
		isLoading = false;
	}

	// Load data when identifier changes
	$effect(() => {
		if (!identifier) return;
		loadProgressionData();
	});

	// Listen for item changes and reload when features/subclasses are modified
	$effect(() => {
		if (!identifier) return;

		function isRelevantItem(item: Item): boolean {
			if (item.type === 'subclass') {
				const subclass = item as { system?: { parentClass?: string } };
				return subclass.system?.parentClass === identifier;
			}
			if (item.type === 'feature') {
				const feature = item as { system?: { class?: string; group?: string } };
				// Check if feature belongs to this class or one of its groups
				if (feature.system?.class === identifier) return true;
				if (feature.system?.group && groupIdentifiers.includes(feature.system.group)) return true;
			}
			return false;
		}

		function onItemChange(item: Item): void {
			if (isRelevantItem(item)) {
				loadProgressionData();
			}
		}

		const hookIds = [
			Hooks.on('createItem', onItemChange),
			Hooks.on('updateItem', onItemChange),
			Hooks.on('deleteItem', onItemChange),
		];

		return () => {
			Hooks.off('createItem', hookIds[0]);
			Hooks.off('updateItem', hookIds[1]);
			Hooks.off('deleteItem', hookIds[2]);
		};
	});

	function handleFeatureClick(feature: NimbleFeatureItem): void {
		feature.sheet?.render(true);
	}

	function handleSubclassClick(uuid: string): void {
		fromUuid(uuid).then((subclass) => {
			if (subclass) {
				(subclass as Item).sheet?.render(true);
			}
		});
	}

	async function handleAddFeature(level: number, classIdentifier: string): Promise<void> {
		// Create a new feature item as a world item with pre-populated values
		const featureData = {
			name: `New Feature (Level ${level})`,
			type: 'feature',
			system: {
				featureType: 'class',
				class: classIdentifier,
				gainedAtLevel: level,
				gainedAtLevels: [level],
				group: `${classIdentifier}-progression`,
				subclass: false,
			},
		};

		const [createdFeature] = await Item.createDocuments([featureData]);
		if (createdFeature) {
			createdFeature.sheet?.render(true);
		}
	}

	function getAbilityScoreEntry(level: number): AbilityScoreDataEntry | null {
		if (!ABILITY_SCORE_LEVELS.includes(level as (typeof ABILITY_SCORE_LEVELS)[number])) {
			return null;
		}
		return abilityScoreData[level as keyof typeof abilityScoreData] ?? null;
	}

	function isSubclassLevel(level: number): boolean {
		return SUBCLASS_LEVELS.includes(level as (typeof SUBCLASS_LEVELS)[number]);
	}

	function formatGroupName(groupName: string): string {
		return groupName.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	async function handleAddFeatureToGroup(
		event: MouseEvent,
		groupName: string,
		levels: number[],
	): Promise<void> {
		event.stopPropagation();

		// Create a new feature item pre-populated for this group
		const featureData = {
			name: `New ${formatGroupName(groupName)} Feature`,
			type: 'feature',
			system: {
				featureType: 'class',
				class: identifier,
				gainedAtLevel: levels[0],
				gainedAtLevels: levels,
				group: groupName,
				subclass: false,
			},
		};

		const [createdFeature] = await Item.createDocuments([featureData]);
		if (createdFeature) {
			createdFeature.sheet?.render(true);
		}
	}

	async function handleAddSubclass(): Promise<void> {
		// Create a new subclass item pre-populated with this class as parent
		const subclassData = {
			name: `New ${item.name} Subclass`,
			type: 'subclass',
			system: {
				parentClass: identifier,
			},
		};

		const [createdSubclass] = await Item.createDocuments([subclassData]);
		if (createdSubclass) {
			createdSubclass.sheet?.render(true);
		}
	}

	async function handleAddNewFeatureChoice(): Promise<void> {
		// Generate a unique group name for a new feature choice
		const existingGroupCount = selectionGroups.size;
		const newGroupName = `${identifier}-choice-${existingGroupCount + 1}`;

		// Create a new feature item with the new group
		const featureData = {
			name: `New Feature Choice`,
			type: 'feature',
			system: {
				featureType: 'class',
				class: identifier,
				gainedAtLevel: 1,
				gainedAtLevels: [1],
				group: newGroupName,
				subclass: false,
			},
		};

		const [createdFeature] = await Item.createDocuments([featureData]);
		if (createdFeature) {
			createdFeature.sheet?.render(true);
		}
	}
</script>

<section class="nimble-sheet__body nimble-sheet__body--item class-progression-tab">
	{#if isLoading}
		<div class="class-progression-tab__loading">
			<i class="fa-solid fa-spinner fa-spin"></i>
			{localize('NIMBLE.classSheet.progressionLoading')}
		</div>
	{:else}
		<!-- Level Progression Rows -->
		<section class="class-progression-tab__levels">
			{#each Array.from({ length: 20 }, (_, i) => i + 1) as level (level)}
				<ClassProgressionLevelRow
					{level}
					levelData={getLevelDataWithoutSelections(level)}
					abilityScoreEntry={getAbilityScoreEntry(level)}
					isSubclassLevel={isSubclassLevel(level)}
					classIdentifier={identifier}
					className={item.name}
					{keyAbilityScores}
					onFeatureClick={handleFeatureClick}
					onAddFeature={handleAddFeature}
				/>
			{/each}
		</section>

		<!-- Subclasses -->
		<section class="class-progression-tab__section">
			<header class="nimble-section-header class-progression-tab__section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.classSheet.progressionAvailableSubclasses')}
				</h3>
				<button
					type="button"
					class="class-progression-tab__section-add-btn"
					onclick={handleAddSubclass}
					title="Add new subclass"
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</header>
			{#if subclasses.length > 0}
				{#each subclasses as subclass (subclass.uuid)}
					<article
						class="class-progression-tab__subclass-accordion"
						class:class-progression-tab__subclass-accordion--expanded={isSubclassExpanded(
							subclass.uuid,
						)}
					>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="class-progression-tab__subclass-header"
							onclick={() => toggleSubclass(subclass.uuid)}
						>
							<i
								class="fa-solid fa-chevron-right class-progression-tab__subclass-chevron"
								class:class-progression-tab__subclass-chevron--expanded={isSubclassExpanded(
									subclass.uuid,
								)}
							></i>
							<img src={subclass.img} alt="" class="class-progression-tab__subclass-img" />
							<span class="class-progression-tab__subclass-name">{subclass.name}</span>
							<button
								type="button"
								class="class-progression-tab__subclass-open-btn"
								onclick={(e) => {
									e.stopPropagation();
									handleSubclassClick(subclass.uuid);
								}}
								title="Open {subclass.name} sheet"
							>
								<i class="fa-solid fa-external-link"></i>
							</button>
						</div>

						{#if isSubclassExpanded(subclass.uuid)}
							<div class="class-progression-tab__subclass-content">
								{#if subclass.description}
									<div class="class-progression-tab__subclass-desc">
										{@html subclass.description}
									</div>
								{:else}
									<p class="class-progression-tab__subclass-no-desc">No description available.</p>
								{/if}
							</div>
						{/if}
					</article>
				{/each}
			{:else}
				<p class="class-progression-tab__empty-message">
					No subclasses available. Click the + button to create one.
				</p>
			{/if}
		</section>

		<!-- Selection Groups (collapsible accordions) -->
		<section class="class-progression-tab__section">
			<header class="nimble-section-header class-progression-tab__section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.classSheet.progressionFeatureChoices')}
				</h3>
				<button
					type="button"
					class="class-progression-tab__section-add-btn"
					onclick={handleAddNewFeatureChoice}
					title="Add new feature choice group"
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</header>
			{#if selectionGroups.size > 0}
				{#each [...selectionGroups.entries()] as [groupName, features] (groupName)}
					<article
						class="class-progression-tab__group-accordion"
						class:class-progression-tab__group-accordion--expanded={isGroupExpanded(groupName)}
					>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="class-progression-tab__group-header" onclick={() => toggleGroup(groupName)}>
							<i
								class="fa-solid fa-chevron-right class-progression-tab__group-chevron"
								class:class-progression-tab__group-chevron--expanded={isGroupExpanded(groupName)}
							></i>
							<span class="class-progression-tab__group-name">{formatGroupName(groupName)}</span>
							<span class="class-progression-tab__group-meta">
								{features.length} options · Levels {getGroupLevels(groupName).join(', ')}
							</span>
							<button
								type="button"
								class="class-progression-tab__group-add-btn"
								onclick={(e) => handleAddFeatureToGroup(e, groupName, getGroupLevels(groupName))}
								title="Add feature to {formatGroupName(groupName)}"
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						</div>

						{#if isGroupExpanded(groupName)}
							<div class="class-progression-tab__group-content">
								<div class="class-progression-tab__feature-grid">
									{#each features as feature (feature.uuid)}
										<article class="class-progression-tab__feature-card">
											<button
												type="button"
												class="class-progression-tab__feature-header"
												onclick={() => handleFeatureClick(feature)}
											>
												<img src={feature.img} alt="" class="class-progression-tab__feature-img" />
												<h4 class="class-progression-tab__feature-name">{feature.name}</h4>
												<i class="fa-solid fa-external-link class-progression-tab__link-icon"></i>
											</button>
											{#if feature.system?.description}
												<div class="class-progression-tab__feature-desc">
													{@html feature.system.description}
												</div>
											{/if}
										</article>
									{/each}
								</div>
							</div>
						{/if}
					</article>
				{/each}
			{:else}
				<p class="class-progression-tab__empty-message">
					No feature choices available. Click the + button to create one.
				</p>
			{/if}
		</section>
	{/if}
</section>

<style lang="scss">
	.class-progression-tab {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem;

		&__loading {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 2rem;
			color: var(--nimble-medium-text-color);
			font-style: italic;
		}

		&__levels {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		// Section styling
		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__section-header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__section-add-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			margin-left: auto;
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
			color: var(--nimble-medium-text-color);
			cursor: pointer;
			flex-shrink: 0;
			transition:
				background 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease;
			font-size: var(--nimble-xs-text);

			&:hover {
				background: var(--nimble-accent-color);
				border-color: var(--nimble-accent-color);
				color: white;
			}
		}

		&__empty-message {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
			margin: 0;
			padding: 0.5rem;
		}

		// Subclass accordion
		&__subclass-accordion {
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-box-background-color);
			overflow: hidden;
		}

		&__subclass-header {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			width: 100%;
			padding: 0.625rem 0.75rem;
			background: transparent;
			cursor: pointer;
			color: inherit;
			text-align: left;
			transition: background 0.15s ease;

			&:hover {
				background: var(--nimble-input-background-color);
			}
		}

		&__subclass-chevron {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			transition: transform 0.2s ease;
			flex-shrink: 0;

			&--expanded {
				transform: rotate(90deg);
			}
		}

		&__subclass-img {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 3px;
			object-fit: cover;
			flex-shrink: 0;
		}

		&__subclass-name {
			flex: 1;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
		}

		&__subclass-open-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
			color: var(--nimble-medium-text-color);
			cursor: pointer;
			flex-shrink: 0;
			transition:
				background 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease;
			font-size: var(--nimble-xs-text);

			&:hover {
				background: var(--nimble-accent-color);
				border-color: var(--nimble-accent-color);
				color: white;
			}
		}

		&__subclass-content {
			padding: 0.75rem;
			padding-top: 0.5rem;
			border-top: 1px solid var(--nimble-card-border-color);
			background: var(--nimble-input-background-color);
		}

		&__subclass-desc {
			font-size: var(--nimble-sm-text);
			line-height: 1.5;

			:global(p) {
				margin: 0 0 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}

			:global(h3),
			:global(h4),
			:global(h5) {
				margin: 0.5rem 0 0.25rem;
				font-size: var(--nimble-sm-text);
				font-weight: 600;

				&:first-child {
					margin-top: 0;
				}
			}

			:global(ul),
			:global(ol) {
				margin: 0.25rem 0;
				padding-left: 1.25rem;
			}

			:global(li) {
				margin-bottom: 0.25rem;
			}

			:global(strong) {
				font-weight: 600;
			}
		}

		&__subclass-no-desc {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
			margin: 0;
		}

		// Group accordion
		&__group-accordion {
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-box-background-color);
			overflow: hidden;
		}

		&__group-header {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			width: 100%;
			padding: 0.625rem 0.75rem;
			background: transparent;
			border: none;
			cursor: pointer;
			color: inherit;
			text-align: left;
			transition: background 0.15s ease;

			&:hover {
				background: var(--nimble-input-background-color);
			}
		}

		&__group-name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
		}

		&__group-meta {
			flex: 1;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__group-add-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			background: transparent;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 3px;
			color: var(--nimble-medium-text-color);
			cursor: pointer;
			flex-shrink: 0;
			transition:
				background 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease;
			font-size: var(--nimble-xs-text);

			&:hover {
				background: var(--nimble-accent-color);
				border-color: var(--nimble-accent-color);
				color: white;
			}
		}

		&__group-chevron {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			transition: transform 0.2s ease;
			flex-shrink: 0;

			&--expanded {
				transform: rotate(90deg);
			}
		}

		&__group-content {
			padding: 0.75rem;
			padding-top: 0.5rem;
			border-top: 1px solid var(--nimble-card-border-color);
			background: var(--nimble-input-background-color);
		}

		// Two-column grid for features
		&__feature-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
		}

		&__feature-card {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.375rem;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}

		&__feature-header {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0;
			background: transparent;
			border: none;
			cursor: pointer;
			color: inherit;
			text-align: left;
			transition: color 0.15s ease;

			&:hover {
				color: var(--nimble-accent-color);

				.class-progression-tab__link-icon {
					color: var(--nimble-accent-color);
				}
			}
		}

		&__feature-img {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 3px;
			object-fit: cover;
			flex-shrink: 0;
		}

		&__feature-name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			margin: 0;
			line-height: 1.3;
			text-align: left;
		}

		&__link-icon {
			font-size: var(--nimble-xxs-text);
			color: var(--nimble-medium-text-color);
			transition: color 0.15s ease;
		}

		&__feature-desc {
			padding-left: 2rem;
			font-size: var(--nimble-xs-text);
			line-height: 1.5;
			text-align: left;

			:global(p) {
				margin: 0 0 0.5rem;
				text-align: left;

				&:last-child {
					margin-bottom: 0;
				}
			}

			:global(h3),
			:global(h4),
			:global(h5) {
				margin: 0.5rem 0 0.25rem;
				font-size: var(--nimble-sm-text);
				font-weight: 600;
				text-align: left;

				&:first-child {
					margin-top: 0;
				}
			}

			:global(ul),
			:global(ol) {
				margin: 0.25rem 0;
				padding-left: 1.25rem;
				text-align: left;
			}

			:global(li) {
				margin-bottom: 0.25rem;
			}
		}
	}
</style>
