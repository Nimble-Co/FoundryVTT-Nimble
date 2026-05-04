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
					getSourceTag={state.getSourceTag}
					onDeleteWorldItem={state.handleDeleteWorldItem}
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
					data-tooltip={localize('NIMBLE.classSheet.progressionAddNewSubclass')}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</header>
			{#if state.subclasses.length > 0}
				{#each state.subclasses as subclass (subclass.uuid)}
					{@const subclassTag = state.getSourceTag(subclass.uuid)}
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
							{#if subclassTag}
								<span
									class="class-progression-tab__source-tag"
									data-source={subclassTag}
									data-tooltip={subclassTag === 'world'
										? localize('NIMBLE.classSheet.progressionSourceTagWorldTooltip')
										: localize('NIMBLE.classSheet.progressionSourceTagPackTooltip')}
								>
									{localize(
										subclassTag === 'world'
											? 'NIMBLE.classSheet.progressionSourceTagWorldLabel'
											: 'NIMBLE.classSheet.progressionSourceTagPackLabel',
									)}
								</span>
							{/if}
							{#if subclassTag === 'world'}
								<button
									type="button"
									class="nimble-button class-progression-tab__delete-btn"
									data-button-variant="icon"
									aria-label={localize('NIMBLE.classSheet.progressionDeleteWorldItemTooltip')}
									data-tooltip={localize('NIMBLE.classSheet.progressionDeleteWorldItemTooltip')}
									onclick={(e) => {
										e.stopPropagation();
										state.handleDeleteWorldItem(subclass.uuid, subclass.name);
									}}
								>
									<i class="fa-solid fa-trash"></i>
								</button>
							{/if}
							<button
								type="button"
								class="class-progression-tab__subclass-open-btn"
								onclick={(e) => {
									e.stopPropagation();
									state.handleSubclassClick(subclass.uuid);
								}}
								data-tooltip={localize('NIMBLE.classSheet.progressionOpenSheet', {
									name: subclass.name,
								})}
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
													data-tooltip={localize('NIMBLE.classSheet.progressionAddFeatureAtLevel', {
														level,
													})}
												>
													<i class="fa-solid fa-plus"></i>
												</button>
											</div>
											{#each levelFeatures as feature (feature.uuid)}
												{@const subclassFeatureTag = state.getSourceTag(feature.uuid)}
												{@const enrichedDesc = state.enrichedFeatureDescriptions.get(feature.uuid)}
												<div class="class-progression-tab__subclass-feature">
													<img
														src={feature.img}
														alt=""
														class="class-progression-tab__feature-img"
													/>
													<div class="class-progression-tab__feature-content">
														<div class="class-progression-tab__feature-title-row">
															<button
																type="button"
																class="class-progression-tab__feature-header"
																data-tooltip={feature.name}
																onclick={() => state.handleFeatureClick(feature)}
															>
																<h4 class="class-progression-tab__feature-name">
																	{feature.name}
																</h4>
																<i
																	class="fa-solid fa-external-link class-progression-tab__link-icon"
																></i>
															</button>
															{#if subclassFeatureTag}
																<span
																	class="class-progression-tab__source-tag"
																	data-source={subclassFeatureTag}
																	data-tooltip={subclassFeatureTag === 'world'
																		? localize('NIMBLE.classSheet.progressionSourceTagWorldTooltip')
																		: localize('NIMBLE.classSheet.progressionSourceTagPackTooltip')}
																>
																	{localize(
																		subclassFeatureTag === 'world'
																			? 'NIMBLE.classSheet.progressionSourceTagWorldLabel'
																			: 'NIMBLE.classSheet.progressionSourceTagPackLabel',
																	)}
																</span>
															{/if}
															{#if subclassFeatureTag === 'world'}
																<button
																	type="button"
																	class="nimble-button class-progression-tab__delete-btn"
																	data-button-variant="icon"
																	aria-label={localize(
																		'NIMBLE.classSheet.progressionDeleteWorldItemTooltip',
																	)}
																	data-tooltip={localize(
																		'NIMBLE.classSheet.progressionDeleteWorldItemTooltip',
																	)}
																	onclick={() =>
																		state.handleDeleteWorldItem(feature.uuid, feature.name)}
																>
																	<i class="fa-solid fa-trash"></i>
																</button>
															{/if}
														</div>
														{#if enrichedDesc || feature.system?.description}
															<div class="class-progression-tab__feature-desc">
																{@html enrichedDesc ?? feature.system?.description ?? ''}
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
					{localize('NIMBLE.classSheet.progressionNoSubclasses')}
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
					data-tooltip={localize('NIMBLE.classSheet.progressionAddNewFeatureChoiceGroup')}
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
								data-tooltip={localize('NIMBLE.classSheet.progressionAddFeatureToGroup', {
									groupName: state.formatGroupName(groupName),
								})}
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						</div>

						{#if state.isGroupExpanded(groupName)}
							<div class="class-progression-tab__group-content">
								<div class="class-progression-tab__feature-grid">
									{#each features as feature (feature.uuid)}
										{@const choiceTag = state.getSourceTag(feature.uuid)}
										{@const enrichedChoiceDesc = state.enrichedFeatureDescriptions.get(
											feature.uuid,
										)}
										<article class="class-progression-tab__feature-card">
											<div class="class-progression-tab__feature-title-row">
												<button
													type="button"
													class="class-progression-tab__feature-header"
													data-tooltip={feature.name}
													onclick={() => state.handleFeatureClick(feature)}
												>
													<img
														src={feature.img}
														alt=""
														class="class-progression-tab__feature-img"
													/>
													<h4 class="class-progression-tab__feature-name">
														{feature.name}
													</h4>
													<i class="fa-solid fa-external-link class-progression-tab__link-icon"></i>
												</button>
												{#if choiceTag}
													<span
														class="class-progression-tab__source-tag"
														data-source={choiceTag}
														data-tooltip={choiceTag === 'world'
															? localize('NIMBLE.classSheet.progressionSourceTagWorldTooltip')
															: localize('NIMBLE.classSheet.progressionSourceTagPackTooltip')}
													>
														{localize(
															choiceTag === 'world'
																? 'NIMBLE.classSheet.progressionSourceTagWorldLabel'
																: 'NIMBLE.classSheet.progressionSourceTagPackLabel',
														)}
													</span>
												{/if}
												{#if choiceTag === 'world'}
													<button
														type="button"
														class="nimble-button class-progression-tab__delete-btn"
														data-button-variant="icon"
														aria-label={localize(
															'NIMBLE.classSheet.progressionDeleteWorldItemTooltip',
														)}
														data-tooltip={localize(
															'NIMBLE.classSheet.progressionDeleteWorldItemTooltip',
														)}
														onclick={() => state.handleDeleteWorldItem(feature.uuid, feature.name)}
													>
														<i class="fa-solid fa-trash"></i>
													</button>
												{/if}
											</div>
											{#if enrichedChoiceDesc || feature.system?.description}
												<div class="class-progression-tab__feature-desc">
													{@html enrichedChoiceDesc ?? feature.system?.description ?? ''}
												</div>
											{:else}
												<p class="class-progression-tab__feature-no-desc">
													{localize('NIMBLE.classSheet.progressionNoDescription')}
												</p>
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
					{localize('NIMBLE.classSheet.progressionNoFeatureChoices')}
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

		&__feature-title-row {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			min-width: 0;
		}

		&__delete-btn {
			flex-shrink: 0;

			&:hover {
				color: var(--color-level-error, hsl(0, 65%, 45%));
			}
		}

		&__feature-title-row &__source-tag {
			margin-left: auto;
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
			align-items: stretch;
			gap: 0.375rem;
			padding: 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			min-width: 0;
		}

		&__feature-header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0;
			background: transparent;
			border: none;
			cursor: pointer;
			color: inherit;
			text-align: left;
			transition: color 0.15s ease;
			flex: 1;
			min-width: 0;
			overflow: hidden;

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
			flex: 1;
			min-width: 0;
			overflow: hidden;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
		}

		&__link-icon {
			font-size: var(--nimble-xxs-text);
			color: var(--nimble-medium-text-color);
			transition: color 0.15s ease;
		}

		&__source-tag {
			display: inline-flex;
			align-items: center;
			padding: 0.0625rem 0.3125rem;
			border-radius: 3px;
			font-size: 0.5625rem;
			font-weight: 700;
			white-space: nowrap;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: white;
			flex-shrink: 0;

			&[data-source='world'] {
				background: var(--nimble-badge-world-bg);
			}

			&[data-source='pack'] {
				background: var(--nimble-badge-pack-bg);
			}
		}

		&__feature-no-desc {
			flex: 1;
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			font-style: italic;
			text-align: center;
			padding: 0.25rem 0;
		}

		&__feature-card &__feature-desc {
			padding-left: 2rem;
		}

		&__feature-desc {
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
