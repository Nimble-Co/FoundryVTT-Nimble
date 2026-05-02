<script lang="ts">
	import type { NimbleClassItem } from '#documents/item/class.js';
	import ClassProgressionLevelRow from '../components/ClassProgressionLevelRow.svelte';
	import localize from '#utils/localize.js';
	import { getContext } from 'svelte';
	import { createClassProgressionTabState } from './ClassProgressionTab.state.svelte.js';

	const item: NimbleClassItem = getContext('document');
	const state = createClassProgressionTabState(() => item);
</script>

<section class="nimble-sheet__body nimble-sheet__body--item class-progression-tab">
	{#if state.isLoading}
		<div class="class-progression-tab__loading">
			<i class="fa-solid fa-spinner fa-spin"></i>
			{localize('NIMBLE.classSheet.progressionLoading')}
		</div>
	{:else}
		<section class="class-progression-tab__levels">
			{#each Array.from({ length: 20 }, (_, i) => i + 1) as level (level)}
				<ClassProgressionLevelRow
					{level}
					levelData={state.progressionData.get(level) ?? {
						level,
						autoGrant: [],
						selectionGroups: new Map(),
					}}
					abilityScoreEntry={state.getAbilityScoreEntry(level)}
					isSubclassLevel={state.isSubclassLevel(level)}
					classIdentifier={state.identifier}
					className={state.className}
					keyAbilityScores={state.keyAbilityScores}
					onFeatureClick={state.handleFeatureClick}
					onAddFeature={state.handleAddFeature}
				/>
			{/each}
		</section>

		<section class="class-progression-tab__section">
			<header class="nimble-section-header class-progression-tab__section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.classSheet.progressionAvailableSubclasses')}
				</h3>
				<button
					type="button"
					class="class-progression-tab__section-add-btn"
					onclick={state.handleAddSubclass}
					title="Add new subclass"
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</header>
			{#if state.subclasses.length > 0}
				{#each state.subclasses as subclass (subclass.uuid)}
					<article
						class="class-progression-tab__subclass-accordion"
						class:class-progression-tab__subclass-accordion--expanded={state.isSubclassExpanded(
							subclass.uuid,
						)}
					>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="class-progression-tab__subclass-header"
							onclick={() => state.toggleSubclass(subclass.uuid)}
						>
							<i
								class="fa-solid fa-chevron-right class-progression-tab__subclass-chevron"
								class:class-progression-tab__subclass-chevron--expanded={state.isSubclassExpanded(
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
									state.handleSubclassClick(subclass.uuid);
								}}
								title="Open {subclass.name} sheet"
							>
								<i class="fa-solid fa-external-link"></i>
							</button>
						</div>

						{#if state.isSubclassExpanded(subclass.uuid)}
							<div class="class-progression-tab__subclass-content">
								<div class="class-progression-tab__subclass-progression">
									{#each state.SUBCLASS_LEVELS as level (level)}
										{@const levelFeatures =
											state.subclassProgressionData.get(subclass.identifier)?.get(level) ?? []}
										<div class="class-progression-tab__subclass-level">
											<div class="class-progression-tab__subclass-level-header">
												<span class="class-progression-tab__subclass-level-label"
													>Level {level}</span
												>
												<button
													type="button"
													class="class-progression-tab__section-add-btn"
													onclick={() =>
														state.handleAddSubclassFeature(
															subclass.identifier,
															subclass.name,
															level,
														)}
													title="Add feature at level {level}"
												>
													<i class="fa-solid fa-plus"></i>
												</button>
											</div>
											{#each levelFeatures as feature (feature.uuid)}
												<div class="class-progression-tab__subclass-feature">
													<img
														src={feature.img}
														alt=""
														class="class-progression-tab__feature-img"
													/>
													<div class="class-progression-tab__feature-content">
														<button
															type="button"
															class="class-progression-tab__feature-header"
															onclick={() => state.handleFeatureClick(feature)}
														>
															<h4 class="class-progression-tab__feature-name">{feature.name}</h4>
															<i class="fa-solid fa-external-link class-progression-tab__link-icon"
															></i>
														</button>
														{#if feature.system?.description}
															<div class="class-progression-tab__feature-desc">
																{@html feature.system.description}
															</div>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									{/each}
								</div>
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

		<section class="class-progression-tab__section">
			<header class="nimble-section-header class-progression-tab__section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.classSheet.progressionFeatureChoices')}
				</h3>
				<button
					type="button"
					class="class-progression-tab__section-add-btn"
					onclick={state.handleAddNewFeatureChoice}
					title="Add new feature choice group"
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</header>
			{#if state.selectionGroups.size > 0}
				{#each [...state.selectionGroups.entries()] as [groupName, features] (groupName)}
					<article
						class="class-progression-tab__group-accordion"
						class:class-progression-tab__group-accordion--expanded={state.isGroupExpanded(
							groupName,
						)}
					>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="class-progression-tab__group-header"
							onclick={() => state.toggleGroup(groupName)}
						>
							<i
								class="fa-solid fa-chevron-right class-progression-tab__group-chevron"
								class:class-progression-tab__group-chevron--expanded={state.isGroupExpanded(
									groupName,
								)}
							></i>
							<span class="class-progression-tab__group-name"
								>{state.formatGroupName(groupName)}</span
							>
							<span class="class-progression-tab__group-meta">
								{features.length} options · Levels {state.getGroupLevels(groupName).join(', ')}
							</span>
							<button
								type="button"
								class="class-progression-tab__group-add-btn"
								onclick={(e) =>
									state.handleAddFeatureToGroup(e, groupName, state.getGroupLevels(groupName))}
								title="Add feature to {state.formatGroupName(groupName)}"
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						</div>

						{#if state.isGroupExpanded(groupName)}
							<div class="class-progression-tab__group-content">
								<div class="class-progression-tab__feature-grid">
									{#each features as feature (feature.uuid)}
										<article class="class-progression-tab__feature-card">
											<button
												type="button"
												class="class-progression-tab__feature-header"
												onclick={() => state.handleFeatureClick(feature)}
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

		&__subclass-progression {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__subclass-level {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__subclass-level-header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__subclass-level-label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
			text-transform: uppercase;
			letter-spacing: 0.05em;
			flex: 1;
		}

		&__subclass-feature {
			display: flex;
			flex-direction: row;
			align-items: flex-start;
			gap: 0.5rem;
			padding-left: 0.25rem;
		}

		&__feature-content {
			flex: 1;
			min-width: 0;
		}

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
