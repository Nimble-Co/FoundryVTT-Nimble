<script lang="ts">
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import type PlayerCharacterSheet from '../../../documents/sheets/PlayerCharacterSheet.svelte.js';
	import type { Readable } from 'svelte/store';
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import { getContext } from 'svelte';
	import prepareAncestryTooltip from '../../dataPreparationHelpers/documentTooltips/prepareAncestryTooltip.js';
	import prepareClassTooltip from '../../dataPreparationHelpers/documentTooltips/prepareClassTooltip.js';
	import prepareSubclassTooltip from '../../dataPreparationHelpers/documentTooltips/prepareSubclassTooltip.js';
	import prepareBoonTooltip from '../../dataPreparationHelpers/documentTooltips/prepareBoonTooltip.js';
	import prepareBackgroundTooltip from '../../dataPreparationHelpers/documentTooltips/prepareBackgroundTooltip.js';
	import prepareFeatureTooltip from '../../dataPreparationHelpers/documentTooltips/prepareFeatureTooltip.js';
	import shouldFlashDroppedItem from '../../../utils/shouldFlashDroppedItem.js';
	import sortItems from '../../../utils/sortItems.js';
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

	function getFeatureMetadata(_item) {
		return null;
	}

	function groupItemsByType(items) {
		return items.reduce((categories, item) => {
			const { type: itemType } = item.reactive;

			categories[itemType] ??= [];
			categories[itemType].push(item);

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

	const tooltipCache = new Map();

	async function prepareItemTooltip(item) {
		const cacheKey = item.reactive._id;
		if (tooltipCache.has(cacheKey)) {
			return tooltipCache.get(cacheKey);
		}

		let tooltip = null;
		switch (item.type) {
			case 'ancestry':
				tooltip = await prepareAncestryTooltip(item.reactive);
				break;
			case 'background':
				tooltip = await prepareBackgroundTooltip(item.reactive);
				break;
			case 'boon':
				tooltip = await prepareBoonTooltip(item.reactive);
				break;
			case 'class':
				tooltip = await prepareClassTooltip(item.reactive);
				break;
			case 'feature':
				tooltip = await prepareFeatureTooltip(item.reactive);
				break;
			case 'subclass':
				tooltip = await prepareSubclassTooltip(item.reactive);
				break;
		}

		if (tooltip) {
			tooltipCache.set(cacheKey, tooltip);
		}
		return tooltip;
	}

	function getItemTooltip(item) {
		const cacheKey = item.reactive._id;
		return tooltipCache.get(cacheKey) || '';
	}

	function handleTooltipMouseEnter(event, item) {
		const element = event.currentTarget;
		if (!tooltipCache.has(item.reactive._id)) {
			prepareItemTooltip(item).then((tooltip) => {
				if (tooltip) {
					element.setAttribute('data-tooltip', tooltip);
				}
			});
		}
	}

	function handleDropFlashAnimationEnd(event: AnimationEvent, itemId: string) {
		if (event.animationName !== DROP_ITEM_FLASH_ANIMATION_NAME) return;
		sheet.clearDroppedItemFlash(itemId);
	}

	function sortItemCategories(
		[categoryA]: [string, unknown],
		[categoryB]: [string, unknown],
	): number {
		return validTypes.indexOf(categoryA) - validTypes.indexOf(categoryB);
	}

	// IMPORTANT: The order of these strings is used for sorting purposes.
	const validTypes = ['feature', 'boon', 'ancestry', 'background', 'class'];
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

	// Invalidate tooltip cache when items change (e.g., name or properties modified)
	$effect(() => {
		// Track changes in regular items
		items.forEach((item) => {
			// Access reactive properties to track changes
			void item.reactive.name;
			void item.reactive.img;
			void item.reactive.system;
			// Clear the cache entry so it will be regenerated on next hover
			tooltipCache.delete(item.reactive._id);
		});
		// Track changes in subclasses
		subclasses.forEach((subclass) => {
			void subclass.reactive.name;
			void subclass.reactive.img;
			void subclass.reactive.system;
			tooltipCache.delete(subclass.reactive._id);
		});
	});

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
					{featureTypeHeadings[categoryName] ?? categoryName}
				</h3>
			</header>

			<ul class="nimble-item-list">
				{#each sortItems(itemCategory) as item (item.reactive._id)}
					{@const metadata = getFeatureMetadata(item)}

					<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role  -->
					<!-- svelte-ignore  a11y_click_events_have_key_events -->
					<li
						class="nimble-document-card nimble-document-card--no-meta"
						class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
						class:nimble-document-card--no-meta={!metadata}
						class:nimble-document-card--drop-flash={shouldFlashDroppedItem(
							droppedItemFlashIds,
							item.reactive._id,
						)}
						data-item-id={item.reactive._id}
						data-tooltip={getItemTooltip(item)}
						data-tooltip-class="nimble-tooltip nimble-tooltip--item"
						data-tooltip-direction="LEFT"
						draggable="true"
						role="button"
						ondragstart={(event) => sheet._onDragStart(event)}
						onanimationend={(event) => handleDropFlashAnimationEnd(event, item.reactive._id)}
						onmouseenter={(event) => handleTooltipMouseEnter(event, item)}
						onclick={() => actor.activateItem(item.reactive._id)}
					>
						<header class="u-semantic-only">
							{#if showEmbeddedDocumentImages}
								<div class="nimble-document-card__img-wrapper">
									<img
										class="nimble-document-card__img"
										src={item.reactive.img}
										alt={item.reactive.name}
									/>
								</div>
							{/if}

							<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
								{item.reactive.name}
							</h4>

							<button
								class="nimble-button"
								style="grid-area: configureButton"
								data-button-variant="icon"
								type="button"
								aria-label="Configure {item.reactive.name}"
								onclick={(event) => configureItem(event, item._id)}
							>
								<i class="fa-solid fa-edit"></i>
							</button>

							<button
								class="nimble-button"
								style="grid-area: deleteButton"
								data-button-variant="icon"
								type="button"
								aria-label="Delete {item.reactive.name}"
								onclick={(event) => deleteItem(event, item._id)}
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</header>
					</li>
					{#if categoryName === 'class' && categorizedSubclasses[item.reactive.system.identifier]?.length}
						<ul class="nimble-item-list nimble-item-list--sublist">
							{#each categorizedSubclasses[item.reactive.system.identifier] as subclass}
								{@const metadata = getFeatureMetadata(subclass)}

								<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<li
									class="nimble-document-card nimble-document-card--no-meta"
									class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
									class:nimble-document-card--no-meta={!metadata}
									class:nimble-document-card--drop-flash={shouldFlashDroppedItem(
										droppedItemFlashIds,
										subclass.reactive._id,
									)}
									data-item-id={subclass.reactive._id}
									data-tooltip={getItemTooltip(subclass)}
									data-tooltip-class="nimble-tooltip nimble-tooltip--item"
									data-tooltip-direction="LEFT"
									draggable="true"
									role="button"
									ondragstart={(event) => sheet._onDragStart(event)}
									onanimationend={(event) =>
										handleDropFlashAnimationEnd(event, subclass.reactive._id)}
									onmouseenter={(event) => handleTooltipMouseEnter(event, subclass)}
									onclick={() => actor.activateItem(subclass._id)}
								>
									{#if showEmbeddedDocumentImages}
										<div class="nimble-document-card__img-wrapper">
											<img
												class="nimble-document-card__img"
												src={subclass.reactive.img}
												alt={subclass.reactive.name}
											/>
										</div>
									{/if}

									<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
										{subclass.reactive.name}
									</h4>

									<button
										class="nimble-button"
										style="grid-area: configureButton"
										data-button-variant="icon"
										type="button"
										aria-label="Configure {subclass.reactive.name}"
										onclick={(event) => configureItem(event, subclass._id)}
									>
										<i class="fa-solid fa-edit"></i>
									</button>

									<button
										class="nimble-button"
										style="grid-area: deleteButton"
										data-button-variant="icon"
										type="button"
										aria-label="Delete {subclass.reactive.name}"
										onclick={(event) => deleteItem(event, subclass._id)}
									>
										<i class="fa-solid fa-trash"></i>
									</button>
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

	.nimble-search-wrapper {
		--nimble-button-min-width: 2.25rem;

		grid-area: search;
		display: flex;
		gap: 0.375rem;
		width: 100%;
	}
</style>
