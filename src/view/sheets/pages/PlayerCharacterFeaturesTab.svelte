<script lang="ts">
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import type PlayerCharacterSheet from '../../../documents/sheets/PlayerCharacterSheet.svelte.js';
	import type { Readable } from 'svelte/store';
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import { getContext } from 'svelte';
	import shouldFlashDroppedItem from '../../../utils/shouldFlashDroppedItem.js';
	import {
		DROP_ITEM_FLASH_ANIMATION_NAME,
		getDroppedItemFlashIds,
		type SheetDropItemFlashState,
	} from '../dropItemFlashState.js';

	import SearchBar from '../components/SearchBar.svelte';

	async function configureItem(event, id) {
		event.stopPropagation();

		await actor.configureItem(id);
	}

	async function createItem(event) {
		event.stopPropagation();

		await actor.createItem({ name: 'New Feature', type: 'feature' });
	}

	async function deleteItem(event, id) {
		event.stopPropagation();

		await actor.deleteItem(id);
	}

	function formatGroupName(name: string): string {
		return name
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function groupItemsByType(items) {
		return items.reduce((categories, item) => {
			const { type: itemType } = item.reactive;

			if (itemType === 'feature') {
				const group = item.reactive.system.group;
				const bucket = group || 'feature';
				categories[bucket] ??= [];
				categories[bucket].push(item);
			} else {
				categories[itemType] ??= [];
				categories[itemType].push(item);
			}

			return categories;
		}, {});
	}

	function groupSubclassesByParentClass(subclasses) {
		return subclasses.reduce((categories, subclass) => {
			const { parentClass } = subclass.reactive.system;

			categories[parentClass] ??= [];
			categories[parentClass].push(subclass);

			return categories;
		}, {});
	}

	function handleDropFlashAnimationEnd(event: AnimationEvent, itemId: string) {
		if (event.animationName !== DROP_ITEM_FLASH_ANIMATION_NAME) return;
		sheet.clearDroppedItemFlash(itemId);
	}

	function sortFeatureItems(items) {
		return [...items].sort((a, b) => {
			const levelA = a.reactive.system?.gainedAtLevel ?? Infinity;
			const levelB = b.reactive.system?.gainedAtLevel ?? Infinity;
			if (levelA !== levelB) return levelA - levelB;
			return (a.reactive.sort ?? 0) - (b.reactive.sort ?? 0);
		});
	}

	function sortItemCategories(
		[categoryA]: [string, unknown],
		[categoryB]: [string, unknown],
	): number {
		const classOrder = validTypes.indexOf('class');

		const getOrder = (cat: string): number => {
			const idx = validTypes.indexOf(cat);
			if (idx !== -1) return idx;
			// Feature groups (non-empty system.group) sort just after 'class'
			return classOrder + 0.5;
		};

		const orderA = getOrder(categoryA);
		const orderB = getOrder(categoryB);

		if (orderA !== orderB) return orderA - orderB;
		return categoryA.localeCompare(categoryB);
	}

	// Local collapse state — resets when the sheet is closed/reopened
	let collapsedState = $state<Record<string, boolean>>({});

	function toggleCollapsed(itemId: string): void {
		collapsedState[itemId] = !(collapsedState[itemId] ?? true);
	}

	function isCollapsed(itemId: string): boolean {
		return collapsedState[itemId] ?? true;
	}

	// IMPORTANT: The order of these strings is used for sorting purposes.
	const validTypes = ['class', 'feature', 'ancestry', 'background', 'boon'];
	const { featureTypeHeadings } = CONFIG.NIMBLE;

	let actor = getContext<NimbleCharacter>('actor');
	let sheet = getContext<PlayerCharacterSheet>('application');
	const sheetState = getContext<SheetDropItemFlashState>('sheetState');
	const editingEnabledStore = getContext<Readable<boolean>>('editingEnabled');
	let droppedItemFlashIds = $derived(new Set(getDroppedItemFlashIds(sheetState)));
	let editingEnabled = $derived($editingEnabledStore ?? true);

	let searchTerm = $state('');
	let items = $derived(filterItems(actor.reactive, validTypes, searchTerm));
	let categorizedItems = $derived(groupItemsByType(items));
	let subclasses = $derived(filterItems(actor.reactive, 'subclass', searchTerm));
	let categorizedSubclasses = $derived(groupSubclassesByParentClass(subclasses));

	// Settings
	let flags = $derived(actor.reactive.flags.nimble);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);
</script>

<header class="nimble-sheet__static nimble-sheet__static--features">
	<div class="nimble-search-wrapper">
		<SearchBar bind:searchTerm />

		{#if editingEnabled}
			<button
				class="nimble-button fa-solid fa-plus"
				data-button-variant="basic"
				type="button"
				aria-label="Create Feature"
				data-tooltip="Create Feature"
				onclick={createItem}
			></button>
		{/if}
	</div>
</header>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	{#each Object.entries(categorizedItems).sort(sortItemCategories) as [categoryName, itemCategory]}
		<div>
			<header>
				<h3 class="nimble-heading" data-heading-variant="section">
					{featureTypeHeadings[categoryName] ?? formatGroupName(categoryName)}
				</h3>
			</header>

			<ul class="nimble-item-list">
				{#each sortFeatureItems(itemCategory) as item (item.reactive._id)}
					<li
						class="nimble-feature-card"
						class:nimble-feature-card--drop-flash={shouldFlashDroppedItem(
							droppedItemFlashIds,
							item.reactive._id,
						)}
						data-item-id={item.reactive._id}
						draggable="true"
						ondragstart={(event) => sheet._onDragStart(event)}
						onanimationend={(event) => handleDropFlashAnimationEnd(event, item.reactive._id)}
					>
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="nimble-feature-card__header"
							role="button"
							tabindex="0"
							aria-expanded={!isCollapsed(item.reactive._id)}
							onclick={() => toggleCollapsed(item.reactive._id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggleCollapsed(item.reactive._id);
								}
							}}
						>
							{#if showEmbeddedDocumentImages}
								<div class="nimble-feature-card__img-wrapper">
									<img
										class="nimble-feature-card__img"
										src={item.reactive.img}
										alt={item.reactive.name}
									/>
									<button
										class="nimble-feature-card__img-activate"
										type="button"
										aria-label="Send {item.reactive.name} to chat"
										onclick={(event) => {
											event.stopPropagation();
											actor.activateItem(item.reactive._id);
										}}
									>
										<i class="fa-solid fa-comment"></i>
									</button>
								</div>
							{/if}

							<h4 class="nimble-feature-card__name nimble-heading" data-heading-variant="item">
								{item.reactive.name}
							</h4>

							{#if item.reactive.system?.gainedAtLevel != null}
								<span class="nimble-feature-card__level"
									>Lv. {item.reactive.system.gainedAtLevel}</span
								>
							{/if}

							{#if editingEnabled}
								<button
									class="nimble-button"
									data-button-variant="icon"
									type="button"
									aria-label="Configure {item.reactive.name}"
									onclick={(event) => configureItem(event, item._id)}
								>
									<i class="fa-solid fa-edit"></i>
								</button>

								<button
									class="nimble-button"
									data-button-variant="icon"
									type="button"
									aria-label="Delete {item.reactive.name}"
									onclick={(event) => deleteItem(event, item._id)}
								>
									<i class="fa-solid fa-trash"></i>
								</button>
							{/if}

							<span
								class="nimble-feature-card__chevron"
								class:nimble-feature-card__chevron--collapsed={isCollapsed(item.reactive._id)}
								aria-hidden="true"
							>
								<i class="fa-solid fa-chevron-down"></i>
							</span>
						</div>

						<div
							class="nimble-feature-card__body"
							class:nimble-feature-card__body--collapsed={isCollapsed(item.reactive._id)}
						>
							<div class="nimble-feature-card__description">
								{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.reactive.system?.description || '') then description}
									{@html description}
								{/await}
							</div>
						</div>
					</li>
					{#if categoryName === 'class' && categorizedSubclasses[item.reactive.system.identifier]?.length}
						<ul class="nimble-item-list nimble-item-list--sublist">
							{#each categorizedSubclasses[item.reactive.system.identifier] as subclass}
								<li
									class="nimble-feature-card"
									class:nimble-feature-card--drop-flash={shouldFlashDroppedItem(
										droppedItemFlashIds,
										subclass.reactive._id,
									)}
									data-item-id={subclass.reactive._id}
									draggable="true"
									ondragstart={(event) => sheet._onDragStart(event)}
									onanimationend={(event) =>
										handleDropFlashAnimationEnd(event, subclass.reactive._id)}
								>
									<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<div
										class="nimble-feature-card__header"
										role="button"
										tabindex="0"
										aria-expanded={!isCollapsed(subclass.reactive._id)}
										onclick={() => toggleCollapsed(subclass.reactive._id)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												toggleCollapsed(subclass.reactive._id);
											}
										}}
									>
										{#if showEmbeddedDocumentImages}
											<div class="nimble-feature-card__img-wrapper">
												<img
													class="nimble-feature-card__img"
													src={subclass.reactive.img}
													alt={subclass.reactive.name}
												/>
												<button
													class="nimble-feature-card__img-activate"
													type="button"
													aria-label="Send {subclass.reactive.name} to chat"
													onclick={(event) => {
														event.stopPropagation();
														actor.activateItem(subclass._id);
													}}
												>
													<i class="fa-solid fa-comment"></i>
												</button>
											</div>
										{/if}

										<h4
											class="nimble-feature-card__name nimble-heading"
											data-heading-variant="item"
										>
											{subclass.reactive.name}
										</h4>

										{#if subclass.reactive.system?.gainedAtLevel != null}
											<span class="nimble-feature-card__level"
												>Lv. {subclass.reactive.system.gainedAtLevel}</span
											>
										{/if}

										{#if editingEnabled}
											<button
												class="nimble-button"
												data-button-variant="icon"
												type="button"
												aria-label="Configure {subclass.reactive.name}"
												onclick={(event) => configureItem(event, subclass._id)}
											>
												<i class="fa-solid fa-edit"></i>
											</button>

											<button
												class="nimble-button"
												data-button-variant="icon"
												type="button"
												aria-label="Delete {subclass.reactive.name}"
												onclick={(event) => deleteItem(event, subclass._id)}
											>
												<i class="fa-solid fa-trash"></i>
											</button>
										{/if}

										<span
											class="nimble-feature-card__chevron"
											class:nimble-feature-card__chevron--collapsed={isCollapsed(
												subclass.reactive._id,
											)}
											aria-hidden="true"
										>
											<i class="fa-solid fa-chevron-down"></i>
										</span>
									</div>

									<div
										class="nimble-feature-card__body"
										class:nimble-feature-card__body--collapsed={isCollapsed(subclass.reactive._id)}
									>
										<div class="nimble-feature-card__description">
											{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(subclass.reactive.system?.description || '') then description}
												{@html description}
											{/await}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				{/each}
			</ul>
		</div>
	{/each}
</section>

<style lang="scss">
	.nimble-item-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.25rem 0 0 0;
		padding: 0;
		list-style: none;

		&--sublist {
			margin-block-start: 0;
			margin-inline-start: 1rem;
		}
	}

	.nimble-feature-card {
		--nimble-heading-color: var(--nimble-card-text-color);

		background: var(--nimble-card-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		box-shadow: var(--nimble-box-shadow);
		color: var(--nimble-card-text-color);
		overflow: hidden;
		transition: var(--nimble-standard-transition);

		&--drop-flash {
			position: relative;
			animation: nimble-drop-item-flash 2.5s ease-in-out forwards;
		}
	}

	.nimble-feature-card__header {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		min-height: 2rem;
		padding-inline-end: 0.25rem;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--nimble-accent-color);
			outline-offset: -2px;
		}
	}

	.nimble-feature-card__img-wrapper {
		position: relative;
		flex-shrink: 0;
		height: 2rem;
		width: 2rem;
		margin-inline-end: 0.5rem;

		&::after {
			content: '';
			position: absolute;
			inset: 0;
			right: -1px;
			border-right: 1px solid var(--nimble-card-border-color);
			pointer-events: none;
			z-index: 1;
		}
	}

	.nimble-feature-card__img {
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 0;
		background-color: rgba(0, 0, 0, 0.7);
		object-fit: cover;
		object-position: center;

		&[src$='.svg' i] {
			padding: 0.2rem;
		}
	}

	.nimble-feature-card__img-activate {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		border: 0;
		color: white;
		cursor: pointer;
		font-size: var(--nimble-sm-text);
		opacity: 0;
		padding: 0;
		transition: opacity var(--nimble-standard-transition);
		z-index: 2;

		&:hover,
		&:focus-visible {
			opacity: 1;
			outline: none;
		}
	}

	.nimble-feature-card__name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1;
		color: var(--nimble-card-text-color);
	}

	.nimble-feature-card__level {
		flex-shrink: 0;
		font-size: var(--nimble-xs-text, 0.65rem);
		color: var(--nimble-medium-text-color);
		white-space: nowrap;
	}

	.nimble-feature-card__chevron {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		color: var(--nimble-medium-text-color);
		font-size: var(--nimble-sm-text);

		i {
			display: inline-block;
			transition: transform 250ms ease-out;
		}

		&--collapsed i {
			transform: rotateX(180deg);
		}
	}

	.nimble-feature-card__body {
		overflow: hidden;
	}

	.nimble-feature-card__description {
		padding: 0.5rem;
		font-size: var(--nimble-md-text);
		line-height: 1.5;
		border-top: 1px solid var(--nimble-card-border-color);
		transition:
			max-height 250ms ease-out,
			padding 250ms ease-out,
			opacity 250ms ease-out,
			border-color 250ms ease-out;
		max-height: 600px;
		opacity: 1;

		.nimble-feature-card__body--collapsed & {
			max-height: 0;
			padding-block: 0;
			opacity: 0;
			border-top-color: transparent;
		}

		:global(p) {
			margin-block: 0;

			& + :global(p) {
				margin-block-start: 0.5rem;
			}
		}
	}

	.nimble-search-wrapper {
		--nimble-button-min-width: 2.25rem;

		grid-area: search;
		display: flex;
		gap: 0.375rem;
		width: 100%;
	}
</style>
