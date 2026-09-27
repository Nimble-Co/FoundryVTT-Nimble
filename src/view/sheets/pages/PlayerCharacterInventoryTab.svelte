<script lang="ts">
	import type { NimbleCharacter } from '#documents/actor/character.js';
	import type PlayerCharacterSheet from '#documents/sheets/PlayerCharacterSheet.svelte.js';
	import { RulesManager } from '#managers/RulesManager.js';
	import localize from '#utils/localize.js';
	import { getPools, getPoolsForItem } from '#utils/chargePool/chargePoolSync.js';
	import shouldFlashDroppedItem from '#utils/shouldFlashDroppedItem.js';
	import sortItems from '#utils/sortItems.js';
	import { SYSTEM_ID } from '#system';
	import ChargeIndicator from '#view/components/ChargeIndicator.svelte';
	import CurrencyTracker from '#view/sheets/components/CurrencyTracker.svelte';
	import filterItems from '#view/dataPreparationHelpers/filterItems.js';
	import prepareObjectTooltip from '#view/dataPreparationHelpers/documentTooltips/prepareObjectTooltip.js';
	import SearchBar from '#view/sheets/components/SearchBar.svelte';
	import {
		canToggleEquipment,
		getDropTargetContainerId,
		groupItemsByContainer,
		groupItemsByType,
		isContainer,
		isDropDataRecord,
	} from './PlayerCharacterInventoryTabUtils.js';
	import {
		DROP_ITEM_FLASH_ANIMATION_NAME,
		getDroppedItemFlashIds,
		type SheetDropItemFlashState,
	} from '#view/sheets/dropItemFlashState.js';
	import { getContext } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type InventorySortableItem = {
		_id: string;
	};

	async function configureItem(event, id) {
		event.stopPropagation();

		await actor.configureItem(id);
	}

	async function createItem(event) {
		event.stopPropagation();

		await actor.createItem({ name: 'New Object', type: 'object' });
	}

	async function deleteItem(event, id) {
		event.stopPropagation();

		const item = actor.items.find((carried) => carried._id === id);
		if (item?.confirmDeleteWithContents && !(await item.confirmDeleteWithContents())) return;

		await actor.deleteItem(id);
	}

	function getObjectMetadata(_item) {
		return null;
	}

	const { objectTypeHeadings } = CONFIG.NIMBLE;

	let actor = getContext<NimbleCharacter>('actor');
	let sheet = getContext<PlayerCharacterSheet>('application');
	const sheetState = getContext<SheetDropItemFlashState>('sheetState');
	let searchTerm = $state('');
	let hoveredContainerId = $state<string | null>(null);
	let droppedItemFlashIds = $derived(new Set(getDroppedItemFlashIds(sheetState)));

	const tooltipCache = new Map();

	// Invalidate tooltip cache when items change (e.g., name or properties modified)
	$effect(() => {
		items.forEach((item) => {
			// Access reactive properties to track changes
			void item.reactive.name;
			void item.reactive.img;
			void item.reactive.system;
			// Clear the cache entry so it will be regenerated on next hover
			tooltipCache.delete(item.reactive._id);
		});
	});

	async function getObjectTooltip(item) {
		const cacheKey = item.reactive._id;
		if (tooltipCache.has(cacheKey)) {
			return tooltipCache.get(cacheKey);
		}

		const tooltip = await prepareObjectTooltip(item.reactive);
		if (tooltip) {
			tooltipCache.set(cacheKey, tooltip);
		}
		return tooltip || '';
	}

	function handleTooltipMouseEnter(event, item) {
		const element = event.currentTarget;
		if (!tooltipCache.has(item.reactive._id)) {
			getObjectTooltip(item).then((tooltip) => {
				if (tooltip) {
					element.setAttribute('data-tooltip', tooltip);
				}
			});
		}
	}

	/**
	 * Moving an object in or out of a container wins over reordering: it is the
	 * change a player is nearly always after, and a reorder can be repeated once the
	 * item is in the right place.
	 */
	async function handleItemDrop(event: DragEvent, item: InventorySortableItem): Promise<void> {
		event.stopPropagation();
		hoveredContainerId = null;

		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

		if (!isDropDataRecord(dropData) || dropData.type !== 'Item') {
			await sheet._onSortItem(event, item);
			return;
		}

		const targetContainerId = getDropTargetContainerId(item);
		const carriedItem = actor.items.find((carried) => carried.uuid === dropData.uuid);

		if (!carriedItem) {
			await createDroppedItemInContainer(event, dropData, targetContainerId);
			return;
		}

		if (carriedItem.id === item.reactive._id) return;

		if ((carriedItem.system.containerId ?? '') === targetContainerId) {
			await sheet._onDropItem(event, dropData);
			return;
		}

		await moveItemToContainer(carriedItem.id, targetContainerId);
	}

	/** A drop on the list itself, rather than on a row, takes the item out of its container. */
	async function handleInventoryDrop(event: DragEvent): Promise<void> {
		hoveredContainerId = null;

		// Anything that is not an item, an active effect for instance, belongs to the
		// sheet's own drop handling, so it is left to bubble.
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
		if (!isDropDataRecord(dropData) || dropData.type !== 'Item') return;

		event.stopPropagation();

		const carriedItem = actor.items.find((carried) => carried.uuid === dropData.uuid);

		if (!carriedItem) {
			await createDroppedItemInContainer(event, dropData, '');
			return;
		}

		if (!carriedItem.system.containerId) return;

		await actor.removeItemFromContainer(carriedItem.id);
	}

	async function moveItemToContainer(itemId: string, containerId: string): Promise<void> {
		if (containerId) {
			await actor.storeItemInContainer(itemId, containerId);
			return;
		}

		await actor.removeItemFromContainer(itemId);
	}

	/**
	 * An item from outside the sheet is created already carrying the container it was
	 * dropped on, so a stack that matches one already in the bag folds into that one
	 * rather than into the loose pile. The sheet checks the container will take it
	 * before anything is created.
	 */
	async function createDroppedItemInContainer(
		event: DragEvent,
		dropData: Record<string, unknown>,
		containerId: string,
	): Promise<void> {
		await sheet._onDropItem(event, dropData, { containerId });
	}

	/** Highlights the container a drag is currently over. */
	function handleContainerDragEnter(item): void {
		if (!isContainer(item)) return;

		hoveredContainerId = item.reactive._id;
	}

	/**
	 * `dragenter` on the row being entered fires before `dragleave` on the row being
	 * left, so only the highlighted row may clear the highlight. Otherwise leaving a
	 * plain row would wipe the highlight a container had just claimed. Crossing onto a
	 * child of the row is not leaving it.
	 */
	function handleContainerDragLeave(event: DragEvent, item): void {
		if (hoveredContainerId !== item.reactive._id) return;

		const movedTo = event.relatedTarget;
		if (movedTo instanceof Node && event.currentTarget instanceof Node) {
			if (event.currentTarget.contains(movedTo)) return;
		}

		hoveredContainerId = null;
	}

	/**
	 * A stored stack grows the container's contents the same way a fresh drop does,
	 * so raising its quantity has to clear the same capacity limit.
	 */
	async function updateItemQuantity(item, quantity: string): Promise<void> {
		const { containerId } = item.reactive.system;

		if (!containerId) {
			await actor.updateItem(item._id, { 'system.quantity': quantity });
			return;
		}

		await actor.updateStoredObjectQuantity(item._id, Number(quantity));
	}

	function handleDropFlashAnimationEnd(event: AnimationEvent, itemId: string) {
		if (event.animationName !== DROP_ITEM_FLASH_ANIMATION_NAME) return;
		sheet.clearDroppedItemFlash(itemId);
	}

	let totalInventorySlots = $derived(actor.reactive.system.inventory.totalSlots ?? 0);
	let usedInventorySlots = $derived(actor.reactive.system.inventory.usedSlots ?? 0);
	let items = $derived(filterItems(actor.reactive, ['object'], searchTerm));
	let visibleContainerIds = $derived(
		new Set(items.filter(isContainer).map((item) => item.reactive._id)),
	);
	// A stored item whose container the search filtered out still needs somewhere to
	// show, so it falls back to the top level.
	let topLevelItems = $derived(
		items.filter((item) => !visibleContainerIds.has(item.reactive.system.containerId)),
	);
	let storedItemsByContainerId = $derived(groupItemsByContainer(items));
	let categorizedItems = $derived(groupItemsByType(topLevelItems));

	let containerCapacityUsage = $derived(
		actor.reactive.system.inventory.containerCapacityUsage ?? {},
	);

	let itemRulesManagers = new SvelteMap();

	// All charge pools for the actor
	let allPools = $derived(getPools(actor.reactive));

	function getItemPools(itemId: string) {
		return getPoolsForItem(actor.reactive, itemId, allPools);
	}

	$effect(() => {
		// Rebuild the maps when items change
		items.forEach((item) => {
			const rulesManager = new RulesManager(item);
			itemRulesManagers.set(item.id, rulesManager);
		});
	});

	// Settings
	let flags = $derived(actor.reactive.flags[SYSTEM_ID]);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);
	let trackInventorySlots = $derived(flags?.trackInventorySlots ?? true);
</script>

<header class="nimble-sheet__static nimble-sheet__static--inventory">
	<!--
    <div class="nimble-hand-contents">
        <i
            class="nimble-hand-contents__background-icon fa-solid fa-hand fa-flip-horizontal"
        ></i>
    </div>

    <div class="nimble-hand-contents">
        <i class="nimble-hand-contents__background-icon fa-solid fa-hand"></i>
    </div> -->

	<div class="nimble-search-wrapper">
		<SearchBar bind:searchTerm />

		<button
			class="nimble-button fa-solid fa-plus"
			data-button-variant="basic"
			type="button"
			aria-label="Create Object"
			data-tooltip="Create Object"
			onclick={createItem}
		></button>
	</div>

	<CurrencyTracker />
</header>

{#snippet inventoryRow(item)}
	{@const metadata = getObjectMetadata(item)}
	{@const rules = itemRulesManagers.get(item.id)}

	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role  -->
	<!-- svelte-ignore  a11y_click_events_have_key_events -->
	<li
		class="nimble-document-card nimble-document-card--actor-inventory"
		class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
		class:nimble-document-card--no-meta={!metadata}
		class:nimble-document-card--drop-flash={shouldFlashDroppedItem(
			droppedItemFlashIds,
			item.reactive._id,
		)}
		class:nimble-document-card--drop-target={hoveredContainerId === item.reactive._id}
		data-item-id={item.reactive._id}
		data-tooltip={tooltipCache.get(item.reactive._id) || ''}
		data-tooltip-class="nimble-tooltip nimble-tooltip--item"
		data-tooltip-direction="LEFT"
		onmouseenter={(event) => handleTooltipMouseEnter(event, item)}
		draggable="true"
		role="button"
		ondragstart={(event) => {
			// A container row wraps its contents, so without this the drag data is
			// overwritten by the container as the event bubbles out of a stored row.
			event.stopPropagation();
			sheet._onDragStart(event);
		}}
		ondragover={(event) => event.preventDefault()}
		ondragenter={() => handleContainerDragEnter(item)}
		ondragleave={(event) => handleContainerDragLeave(event, item)}
		ondragend={() => (hoveredContainerId = null)}
		ondrop={(event) => handleItemDrop(event, item)}
		onanimationend={(event) => handleDropFlashAnimationEnd(event, item.reactive._id)}
		onclick={(event) => {
			event.stopPropagation();
			actor.activateItem(item._id);
		}}
	>
		<header class="u-semantic-only">
			{#if showEmbeddedDocumentImages}
				<div class="nimble-document-card__img-wrapper">
					<img class="nimble-document-card__img" src={item.reactive.img} alt={item.reactive.name} />
				</div>
			{/if}

			<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
				{item.reactive.name}
			</h4>

			<div class="nimble-document-card__charges">
				<ChargeIndicator
					pools={getItemPools(item.reactive._id)}
					{actor}
					itemId={item.reactive._id}
				/>
			</div>

			{#if rules && canToggleEquipment(item)}
				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={localize('NIMBLE.prompts.toggleEquipment', {
						name: item.reactive.name,
					})}
					data-tooltip={item.reactive.system.equipped
						? localize('NIMBLE.prompts.equippedTooltip')
						: localize('NIMBLE.prompts.unequippedTooltip')}
					onclick={async (event) => {
						event.stopPropagation();
						await item.toggleEquipment();
					}}
				>
					{#if ['armor', 'shield'].includes(item.reactive.system.objectType)}
						{#if item.reactive.system.equipped}
							<i class="fa-solid fa-shield"></i>
						{:else}
							<i class="fa-regular fa-shield"></i>
						{/if}
					{:else if item.reactive.system.equipped}
						<i class="fa-solid fa-hand"></i>
					{:else}
						<i class="fa-regular fa-hand"></i>
					{/if}
				</button>
			{:else}
				<input
					class="nimble-document-card__quantity"
					type="number"
					value={item.reactive.system.quantity || 1}
					min="0"
					step="1"
					onclick={(event) => event.stopPropagation()}
					onchange={({ currentTarget }) => updateItemQuantity(item, currentTarget.value)}
				/>
			{/if}

			<button
				class="nimble-button"
				style="grid-area: configureButton"
				data-button-variant="icon"
				type="button"
				aria-label={localize('NIMBLE.prompts.configureItem', { name: item.name })}
				onclick={(event) => configureItem(event, item._id)}
			>
				<i class="fa-solid fa-edit"></i>
			</button>

			<button
				class="nimble-button"
				style="grid-area: deleteButton"
				data-button-variant="icon"
				type="button"
				aria-label={localize('NIMBLE.prompts.deleteItem', { name: item.name })}
				onclick={(event) => deleteItem(event, item._id)}
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</header>

		{#if isContainer(item)}
			{@const storedItems = storedItemsByContainerId[item.reactive._id] ?? []}
			{@const capacity = item.reactive.system.container.capacity}

			<div class="nimble-container-contents">
				{#if capacity !== null}
					<span class="nimble-container-contents__capacity">
						{localize('NIMBLE.containers.capacityUsage', {
							used: String(containerCapacityUsage[item.reactive._id] ?? 0),
							capacity: String(capacity),
						})}
					</span>
				{/if}

				{#if storedItems.length === 0}
					<span class="nimble-container-contents__empty">
						{localize('NIMBLE.containers.empty')}
					</span>
				{:else}
					<ul class="nimble-item-list nimble-item-list--stored">
						{#each sortItems(storedItems) as storedItem (storedItem.reactive._id)}
							{@render inventoryRow(storedItem)}
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</li>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
	class="nimble-sheet__body nimble-sheet__body--player-character"
	ondragover={(event) => event.preventDefault()}
	ondrop={handleInventoryDrop}
>
	{#each Object.entries(categorizedItems).sort(([aKey], [bKey]) => aKey - bKey) as [key, itemCategory]}
		{@const categoryName = objectTypeHeadings[key] ?? key}

		<div>
			<header>
				<h3 class="nimble-heading" data-heading-variant="section">
					{categoryName}
				</h3>
			</header>

			<ul class="nimble-item-list">
				{#each sortItems(itemCategory) as item (item.reactive._id)}
					{@render inventoryRow(item)}
				{/each}
			</ul>
		</div>
	{/each}
</section>

{#if trackInventorySlots}
	<footer class="nimble-sheet__footer nimble-sheet__footer--inventory">
		<h4 class="nimble-heading" data-heading-variant="section">
			Inventory Slots:

			{#if usedInventorySlots > totalInventorySlots}
				<i
					class="nimble-heading__icon nimble-heading__icon--warning fa-solid fa-triangle-exclamation fa-beat"
					data-tooltip="You have exceeded your inventory slot limit."
				></i>
			{/if}
		</h4>

		<span>{usedInventorySlots} / {totalInventorySlots}</span>
	</footer>
{/if}

<style lang="scss">
	// .nimble-hand-contents {
	//     display: flex;
	//     align-items: center;
	//     justify-content: center;
	//     height: 100%;
	//     width: 100%;
	//     border: 1px solid hsl(41, 18%, 54%);
	//     background: var(--nimble-hp-bar-background);
	//     box-shadow: var(--nimble-box-shadow);
	//     border-radius: 4px;

	//     &__background-icon {
	//         font-size: var(--nimble-xl-text);
	//         color: var(--nimble-light-text-color);
	//         opacity: 0.65;
	//     }
	// }

	.nimble-item-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.25rem 0 0 0;
		padding: 0;
		list-style: none;
		width: 100%;

		&--stored {
			margin: 0;
		}
	}

	.nimble-document-card--drop-target {
		outline: 2px dashed var(--nimble-accent-color);
		outline-offset: 1px;
	}

	.nimble-container-contents {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		grid-column: 1 / -1;
		margin-top: 0.25rem;
		padding-left: 0.75rem;
		border-left: 2px solid var(--nimble-accent-color);

		&__capacity,
		&__empty {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
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
