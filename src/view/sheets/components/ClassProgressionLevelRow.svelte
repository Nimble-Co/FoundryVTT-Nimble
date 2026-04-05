<script lang="ts">
	import type { ClassProgressionLevelRowProps } from '#types/components/ClassProgressionTab.d.ts';
	import type { NimbleFeatureItem } from '#documents/item/feature.js';

	import localize from '../../../utils/localize.js';

	let {
		level,
		levelData,
		abilityScoreEntry,
		isSubclassLevel,
		classIdentifier,
		onFeatureClick,
		onAddFeature,
	}: ClassProgressionLevelRowProps = $props();

	let isExpanded = $state(false);

	const hasFeatures = $derived(
		levelData.autoGrant.length > 0 || levelData.selectionGroups.size > 0,
	);

	// Row is expandable if it has features, subclass level, or ability score entry
	const isExpandable = $derived(hasFeatures || isSubclassLevel || abilityScoreEntry !== null);

	const hasContent = $derived(hasFeatures || abilityScoreEntry !== null || isSubclassLevel);

	function toggleExpanded(): void {
		if (isExpandable) {
			isExpanded = !isExpanded;
		}
	}

	function handleFeatureClick(event: MouseEvent, feature: NimbleFeatureItem): void {
		event.stopPropagation();
		onFeatureClick(feature);
	}

	function formatGroupName(groupName: string): string {
		return groupName.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function getFeatureNames(): string {
		const names: string[] = [];
		for (const feature of levelData.autoGrant) {
			names.push(feature.name);
		}
		for (const [, features] of levelData.selectionGroups) {
			for (const feature of features) {
				names.push(feature.name);
			}
		}
		return names.join(', ');
	}

	function getStatIncreaseDescription(): string {
		if (!abilityScoreEntry) return '';
		if (abilityScoreEntry.statIncreaseType === 'primary') {
			return '+1 to your Primary stat (STR or DEX)';
		} else if (abilityScoreEntry.statIncreaseType === 'secondary') {
			return '+1 to your Secondary stat (STR or DEX)';
		} else if (abilityScoreEntry.statIncreaseType === 'capstone') {
			return 'Capstone: +1 to any two stats';
		}
		return '';
	}

	function handleAddFeature(event: MouseEvent): void {
		event.stopPropagation();
		onAddFeature(level, classIdentifier);
	}
</script>

<article
	class="class-progression-level-row"
	class:class-progression-level-row--empty={!hasContent}
	class:class-progression-level-row--expanded={isExpanded}
	class:class-progression-level-row--expandable={isExpandable}
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="class-progression-level-row__header"
		onclick={isExpandable ? toggleExpanded : undefined}
	>
		<span class="class-progression-level-row__level-badge">
			{level}
		</span>

		<div class="class-progression-level-row__summary">
			{#if hasFeatures}
				<span class="class-progression-level-row__feature-summary">
					{getFeatureNames()}
				</span>
			{:else if isSubclassLevel && !abilityScoreEntry}
				<span class="class-progression-level-row__feature-summary"> Subclass Feature </span>
			{:else if abilityScoreEntry && !isSubclassLevel}
				<span class="class-progression-level-row__feature-summary"> Ability Score Increase </span>
			{:else if abilityScoreEntry && isSubclassLevel}
				<span class="class-progression-level-row__feature-summary">
					Subclass Feature, Ability Score Increase
				</span>
			{:else}
				<span class="class-progression-level-row__empty-text">
					{localize('NIMBLE.classSheet.progressionNoFeatures')}
				</span>
			{/if}
		</div>

		<div class="class-progression-level-row__badges">
			{#if abilityScoreEntry}
				<span
					class="class-progression-level-row__badge"
					data-type={abilityScoreEntry.statIncreaseType}
				>
					{#if abilityScoreEntry.statIncreaseType === 'primary'}
						+1 Primary
					{:else if abilityScoreEntry.statIncreaseType === 'secondary'}
						+1 Secondary
					{:else if abilityScoreEntry.statIncreaseType === 'capstone'}
						Capstone
					{/if}
				</span>
			{/if}

			{#if isSubclassLevel}
				<span
					class="class-progression-level-row__badge class-progression-level-row__badge--subclass"
				>
					Subclass
				</span>
			{/if}
		</div>

		<button
			type="button"
			class="class-progression-level-row__add-btn"
			onclick={handleAddFeature}
			title="Add feature at level {level}"
		>
			<i class="fa-solid fa-plus"></i>
		</button>

		{#if isExpandable}
			<i
				class="fa-solid fa-chevron-down class-progression-level-row__expand-icon"
				class:class-progression-level-row__expand-icon--expanded={isExpanded}
			></i>
		{/if}
	</div>

	{#if isExpanded && isExpandable}
		<div class="class-progression-level-row__content">
			<!-- Auto-granted features -->
			{#if levelData.autoGrant.length > 0}
				{#each levelData.autoGrant as feature (feature.uuid)}
					<div class="class-progression-level-row__feature">
						<button
							type="button"
							class="class-progression-level-row__feature-header"
							onclick={(e) => handleFeatureClick(e, feature)}
						>
							<img src={feature.img} alt="" class="class-progression-level-row__feature-img" />
							<h4 class="class-progression-level-row__feature-name">{feature.name}</h4>
							<i class="fa-solid fa-external-link class-progression-level-row__link-icon"></i>
						</button>
						{#if feature.system?.description}
							<div class="class-progression-level-row__feature-desc">
								{@html feature.system.description}
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			<!-- Selection groups -->
			{#if levelData.selectionGroups.size > 0}
				{#each [...levelData.selectionGroups.entries()] as [groupName, features] (groupName)}
					<div class="class-progression-level-row__selection-group">
						<h5 class="class-progression-level-row__group-label">
							{formatGroupName(groupName)} (Choose 1)
						</h5>
						<div class="class-progression-level-row__choices">
							{#each features as feature (feature.uuid)}
								<div class="class-progression-level-row__choice">
									<button
										type="button"
										class="class-progression-level-row__feature-header"
										onclick={(e) => handleFeatureClick(e, feature)}
									>
										<img
											src={feature.img}
											alt=""
											class="class-progression-level-row__feature-img"
										/>
										<h4 class="class-progression-level-row__feature-name">{feature.name}</h4>
										<i class="fa-solid fa-external-link class-progression-level-row__link-icon"></i>
									</button>
									{#if feature.system?.description}
										<div class="class-progression-level-row__feature-desc">
											{@html feature.system.description}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}

			<!-- Subclass feature info -->
			{#if isSubclassLevel}
				<div class="class-progression-level-row__info-block">
					<i class="fa-solid fa-star class-progression-level-row__info-icon"></i>
					<p class="class-progression-level-row__info-text">
						{#if level === 3}
							Choose your subclass and gain its level 3 feature.
						{:else}
							Gain your subclass feature for this level.
						{/if}
					</p>
				</div>
			{/if}

			<!-- Ability score increase info -->
			{#if abilityScoreEntry}
				<div class="class-progression-level-row__info-block">
					<i class="fa-solid fa-arrow-up class-progression-level-row__info-icon"></i>
					<p class="class-progression-level-row__info-text">
						{getStatIncreaseDescription()}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</article>

<style lang="scss">
	.class-progression-level-row {
		display: flex;
		flex-direction: column;
		border-radius: 4px;
		border: 1px solid var(--nimble-card-border-color);
		background: var(--nimble-box-background-color);
		color: inherit;
		overflow: hidden;

		&--empty {
			opacity: 0.5;
		}

		&--expandable &__header {
			cursor: pointer;

			&:hover {
				background: var(--nimble-input-background-color);
			}
		}

		&__header {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.5rem 0.625rem;
			background: transparent;
			color: inherit;
			text-align: left;
			width: 100%;
			cursor: default;
			transition: background 0.15s ease;
			min-height: 2.5rem;
		}

		&__level-badge {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			background: var(--nimble-navigation-background-color);
			color: var(--nimble-navigation-text-color);
			border-radius: 50%;
			font-weight: bold;
			font-size: var(--nimble-xs-text);
			flex-shrink: 0;
		}

		&__summary {
			flex: 1;
			min-width: 0;
			text-align: left;
		}

		&__feature-summary {
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1.4;
		}

		&__badges {
			display: flex;
			flex-shrink: 0;
			gap: 0.375rem;
		}

		&__badge {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			padding: 0.1875rem 0.5rem;
			border-radius: 3px;
			font-size: 0.6875rem;
			font-weight: 600;
			white-space: nowrap;
			text-transform: uppercase;
			letter-spacing: 0.02em;

			// High contrast colors for WCAG compliance
			&[data-type='primary'] {
				background: #1a5c1a;
				color: #ffffff;
			}

			&[data-type='secondary'] {
				background: #2d4a5e;
				color: #ffffff;
			}

			&[data-type='capstone'] {
				background: #8b5a00;
				color: #ffffff;
			}

			&--subclass {
				background: #5c3d7a;
				color: #ffffff;
			}
		}

		&__add-btn {
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

		&__expand-icon {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			transition: transform 0.2s ease;
			flex-shrink: 0;

			&--expanded {
				transform: rotate(180deg);
			}
		}

		&__empty-text {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 0.75rem;
			padding-top: 0.5rem;
			border-top: 1px solid var(--nimble-card-border-color);
			background: var(--nimble-input-background-color);
		}

		&__feature {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.375rem;
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

				.class-progression-level-row__link-icon {
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

		&__selection-group {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding-left: 0.75rem;
			border-left: 2px solid var(--nimble-box-color);
		}

		&__group-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			margin: 0;
			text-align: left;
		}

		&__choices {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
		}

		&__choice {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__info-block {
			display: flex;
			align-items: flex-start;
			gap: 0.5rem;
			padding: 0.5rem 0.75rem;
			background: rgba(0, 0, 0, 0.05);
			border-radius: 4px;
		}

		&__info-icon {
			flex-shrink: 0;
			color: var(--nimble-dark-text-color);
			font-size: var(--nimble-sm-text);
			margin-top: 0.125rem;
		}

		&__info-text {
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1.4;
			text-align: left;
		}
	}
</style>
