<script lang="ts">
	import { getContext } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import sortItems from '../../../utils/sortItems.js';
	import ArmorClass from '../components/ArmorClass.svelte';
	import MovementSpeed from '../components/MovementSpeed.svelte';
	import SavingThrows from '../components/SavingThrows.svelte';

	async function configureItem(event, id) {
		event.stopPropagation();

		await actor.configureItem(id);
	}

	async function createItem(event) {
		event.stopPropagation();

		await actor.createItem({ name: 'New Feature', type: 'monsterFeature' });
	}

	async function deleteItem(event, id) {
		event.stopPropagation();

		await actor.deleteItem(id);
	}

	function groupItemsByType(items) {
		return items.reduce((categories, item) => {
			// Group attackSequence items with action items
			const itemType = mapMonsterFeatureToCategory(item);
			categories[itemType] ??= [];
			categories[itemType].push(item);
			return categories;
		}, {});
	}

	function sortItemCategories([categoryA], [categoryB]) {
		return categoryOrder.indexOf(categoryA) - categoryOrder.indexOf(categoryB);
	}

	// Valid subtypes for monster features
	const validSubtypes = ['feature', 'action', 'attackSequence', 'bloodied', 'lastStand'];
	// Categories for grouping/display (attackSequence is grouped with action)
	const categoryOrder = ['feature', 'action', 'bloodied', 'lastStand'];

	function filterMonsterFeatures(actor) {
		return actor.items.filter((item) => {
			if (!validSubtypes.includes(item.system?.subtype)) return false;

			return item.name.toLocaleLowerCase();
		});
	}

	function mapMonsterFeatureToType(item) {
		return item.system?.subtype || 'feature';
	}

	function mapMonsterFeatureToCategory(item) {
		const subtype = item.system?.subtype || 'feature';
		// Group attackSequence items with action items
		if (subtype === 'attackSequence') return 'action';
		// Actions with a parent are still in the action category
		return subtype;
	}

	function isAttackSequenceItem(item) {
		const subtype = item.system?.subtype || item.reactive?.system?.subtype;
		return subtype === 'attackSequence';
	}

	function isActionItem(item) {
		const subtype = item.system?.subtype || item.reactive?.system?.subtype;
		return subtype === 'action';
	}

	function getParentItemId(item) {
		return item.system?.parentItemId || item.reactive?.system?.parentItemId || null;
	}

	// Get a flat list of action items in display order (for unified drag-drop)
	// Order: orphan actions first, then each attackSequence followed by its children
	function getFlatActionList(actionItems) {
		const attackSequences = sortItems(actionItems.filter(isAttackSequenceItem));
		const actions = actionItems.filter(isActionItem);

		// Build a set of valid attack sequence IDs
		const validAttackSequenceIds = new Set();
		for (const attackSeq of attackSequences) {
			const id = attackSeq.reactive?._id || attackSeq._id;
			if (id) validAttackSequenceIds.add(id);
		}

		// Group actions by their parent (only if parent exists)
		const childrenByParent = new Map();
		const orphanActions = [];

		for (const action of actions) {
			const parentId = getParentItemId(action);
			// Only treat as child if parentId matches a known attack sequence
			if (parentId && validAttackSequenceIds.has(parentId)) {
				if (!childrenByParent.has(parentId)) {
					childrenByParent.set(parentId, []);
				}
				childrenByParent.get(parentId).push(action);
			} else {
				// Treat as orphan if no parent or parent doesn't exist
				orphanActions.push(action);
			}
		}

		// Sort children within each group
		for (const [parentId, children] of childrenByParent) {
			childrenByParent.set(parentId, sortItems(children));
		}

		// Build flat list in display order
		const flatList = [];

		// First: orphan actions
		for (const action of sortItems(orphanActions)) {
			flatList.push({ item: action, parentId: null });
		}

		// Then: each attackSequence followed by its children
		for (const attackSeq of attackSequences) {
			const attackSeqId = attackSeq.reactive?._id || attackSeq._id;
			flatList.push({ item: attackSeq, parentId: null, isAttackSequence: true });

			const children = childrenByParent.get(attackSeqId) || [];
			for (const child of children) {
				flatList.push({ item: child, parentId: attackSeqId });
			}
		}

		return flatList;
	}

	// Determine what parent an item would have if dropped at position relative to target
	function getDropTargetParent(flatList, targetId, position) {
		const targetIndex = flatList.findIndex((entry) => entry.item.reactive._id === targetId);
		if (targetIndex === -1) return null;

		const targetEntry = flatList[targetIndex];

		if (position === 'above') {
			// Dropping above: inherit parent of target (or null if target is attackSequence)
			if (targetEntry.isAttackSequence) {
				// Above an attackSequence = orphan (no parent)
				return null;
			}
			return targetEntry.parentId;
		} else {
			// Dropping below
			if (targetEntry.isAttackSequence) {
				// Below an attackSequence = become its child
				return targetEntry.item.reactive._id;
			}
			// Below an action = same parent as that action
			return targetEntry.parentId;
		}
	}

	function prepareItemTooltip(_item) {
		return null;
	}

	function getFeatureMetadata(_item) {
		return null;
	}

	function getReachRangeLabel(item) {
		const targets = item.reactive?.system?.activation?.targets;
		if (!targets?.attackType) return null;

		const key = targets.attackType === 'reach' ? 'NIMBLE.npcSheet.reach' : 'NIMBLE.npcSheet.range';
		return game.i18n.format(key, { distance: targets.distance });
	}

	function isHeaderItem(item) {
		// Check if this item should be rendered as a header instead of a card
		// Header items have no description and no activation effects
		const hasDescription =
			item.reactive?.system?.description && item.reactive.system.description.trim() !== '';
		const hasEffects =
			item.reactive?.system?.activation?.effects &&
			item.reactive.system.activation.effects.length > 0;
		return !hasDescription && !hasEffects;
	}

	// function getMonsterFeatureIcon(categoryName) {
	// 	switch (categoryName) {
	// 		case 'bloodied':
	// 			return 'fa-solid fa-droplet';
	// 		case 'last stand':
	// 			return 'fa-solid fa-skull';
	// 		case 'action':
	// 			return 'fa-solid fa-bolt';
	// 		default:
	// 			return 'fa-solid fa-message';
	// 	}
	// }

	async function handleDrop(event, targetId, position, newParentId) {
		const draggedId = event.dataTransfer.getData('nimble/reorder');
		if (!draggedId) return;

		event.preventDefault();

		const draggedItem = actor.items.get(draggedId);
		const targetItem = actor.items.get(targetId);
		if (!draggedItem || !targetItem) return;

		// Use category for drag-drop (attackSequence can drag with action)
		const draggedCategory = mapMonsterFeatureToCategory(draggedItem);
		const targetCategory = mapMonsterFeatureToCategory(targetItem);
		if (draggedCategory !== targetCategory) return;

		// For action category, use flat list for reordering
		if (draggedCategory === 'action') {
			const flatList = flatActionList;
			const draggedIndex = flatList.findIndex((entry) => entry.item.reactive._id === draggedId);
			let targetIndex = flatList.findIndex((entry) => entry.item.reactive._id === targetId);
			if (draggedIndex === -1 || targetIndex === -1) return;

			// Adjust target index based on drop position
			if (position === 'below') {
				targetIndex += 1;
			}

			// Adjust for the removal of the dragged item
			if (draggedIndex < targetIndex) {
				targetIndex -= 1;
			}

			// Build new order
			const newList = [...flatList];
			const [removed] = newList.splice(draggedIndex, 1);
			newList.splice(targetIndex, 0, removed);

			// Update sort order and parent assignment
			const updates = newList.map((entry, index) => {
				const update = {
					_id: entry.item.reactive._id,
					sort: index * 10000,
				};

				// Update parentItemId for the dragged action item (not attackSequences)
				if (entry.item.reactive._id === draggedId && isActionItem(draggedItem)) {
					update['system.parentItemId'] = newParentId || null;
				}

				return update;
			});

			await actor.updateEmbeddedDocuments('Item', updates);
			return;
		}

		// For other categories, use simple reordering
		const categoryItems = categorizedItems[draggedCategory];
		const draggedIndex = categoryItems.findIndex((item) => item.reactive._id === draggedId);
		let targetIndex = categoryItems.findIndex((item) => item.reactive._id === targetId);
		if (draggedIndex === -1 || targetIndex === -1) return;

		// Adjust target index based on drop position
		if (position === 'below') {
			targetIndex += 1;
		}

		// Adjust for the removal of the dragged item
		if (draggedIndex < targetIndex) {
			targetIndex -= 1;
		}

		const newItems = [...categoryItems];
		newItems.splice(draggedIndex, 1);
		newItems.splice(targetIndex, 0, draggedItem);

		const updates = newItems.map((item, index) => ({
			_id: item.reactive._id,
			sort: index * 10000,
		}));
		await actor.updateEmbeddedDocuments('Item', updates);
	}

	function getArmorClassLabel(armor) {
		return npcArmorTypeAbbreviations[armor] ?? '-';
	}

	function updateArmorCategory(direction) {
		const armor = actor.reactive.system.attributes.armor;

		if (direction === 'increase') {
			if (armor === 'heavy') return;

			if (armor === 'medium') {
				actor.update({ 'system.attributes.armor': 'heavy' });
			} else {
				actor.update({ 'system.attributes.armor': 'medium' });
			}
		} else if (direction === 'decrease') {
			if (armor === 'heavy') {
				actor.update({ 'system.attributes.armor': 'medium' });
			} else if (armor === 'medium') {
				actor.update({ 'system.attributes.armor': 'none' });
			}
		}
	}

	const { npcArmorTypeAbbreviations, creatureFeatures, monsterFeatureTypes } = CONFIG.NIMBLE;

	let actor = getContext('actor');
	let sheet = getContext('application');

	// Local state for collapsed items - always use for immediate UI response
	let localCollapsedState = new SvelteMap();

	// Check if the actor is editable (not from compendium and user has permission)
	let isEditable = $derived.by(() => {
		// If actor is in a compendium pack, it's not editable
		if (actor.pack) return false;
		// Check if user has permission to modify
		return actor.canUserModify?.(game.user, 'update') ?? true;
	});

	// Toggle collapsed state for an item
	function toggleItemCollapsed(item, shouldCollapse) {
		// Always update local state immediately for instant UI response
		localCollapsedState.set(item.reactive._id, shouldCollapse);

		// Persist to document in background if editable (non-blocking)
		if (isEditable) {
			item.reactive.update({ 'flags.nimble.collapsed': shouldCollapse });
		}
	}

	// Get collapsed state for an item
	function getItemCollapsed(item) {
		// Always prefer local state for immediate responsiveness
		if (localCollapsedState.has(item.reactive._id)) {
			return localCollapsedState.get(item.reactive._id);
		}
		// Fall back to document flags
		return item.reactive.flags.nimble?.collapsed ?? false;
	}

	let dragOverItemId = $state(null);
	let dragOverPosition = $state(null); // 'above' or 'below'
	let draggedItemCategory = $state(null); // track category of item being dragged
	let dragOverTargetParent = $state(null); // track what parent the item would have if dropped here
	let draggedItemIsAttackSequence = $state(false); // track if dragged item is an attack sequence

	let items = $derived(filterMonsterFeatures(actor.reactive));
	let categorizedItems = $derived(groupItemsByType(items));
	let flatActionList = $derived(getFlatActionList(categorizedItems['action'] || []));

	let flags = $derived(actor.reactive.flags.nimble);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

	let allCollapsed = $derived(items.every((item) => getItemCollapsed(item)));

	// Track which category section is currently visible at the top
	let visibleCategory = $state<string | null>(null);
	let scrollContainer: HTMLElement | null = $state(null);

	function handleScroll(event: Event) {
		const container = event.target as HTMLElement;
		if (!container) return;

		// Find which category section is at the top of the scroll area
		const sections = container.querySelectorAll('[data-category]');
		let topSection: string | null = null;

		for (const section of sections) {
			const rect = section.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			// Check if section top is at or above the container top (with some threshold)
			const relativeTop = rect.top - containerRect.top;

			if (relativeTop <= 20) {
				topSection = (section as HTMLElement).dataset.category || null;
			}
		}

		visibleCategory = topSection;
	}

	function registerScrollContainer(node: HTMLElement) {
		scrollContainer = node;
		node.addEventListener('scroll', handleScroll);

		return {
			destroy() {
				node.removeEventListener('scroll', handleScroll);
				scrollContainer = null;
			},
		};
	}
</script>

<section class="nimble-sheet__body nimble-sheet__body--npc">
	<section class="nimble-monster-sheet-section nimble-monster-sheet-section--defenses">
		<SavingThrows characterSavingThrows={actor.reactive.system.savingThrows} />

		<section class="nimble-other-attribute-wrapper" style="grid-area: armor;">
			<header class="nimble-section-header" data-header-alignment="center">
				<h3 class="nimble-heading" data-heading-variant="section">
					{game.i18n.localize('NIMBLE.npcSheet.armor')}
				</h3>
			</header>

			<ArmorClass armorClass={getArmorClassLabel(actor.reactive.system.attributes.armor)} />

			<button
				class="nimble-button nimble-armor-config-button nimble-armor-config-button--decrement"
				data-button-variant="basic"
				type="button"
				aria-label={game.i18n.localize('NIMBLE.npcSheet.decreaseArmor')}
				data-tooltip={game.i18n.localize('NIMBLE.npcSheet.decreaseArmor')}
				disabled={actor.reactive.system.armor === 'none'}
				onclick={() => updateArmorCategory('decrease')}
			>
				-
			</button>

			<button
				class="nimble-button nimble-armor-config-button nimble-armor-config-button--increment"
				data-button-variant="basic"
				type="button"
				aria-label={game.i18n.localize('NIMBLE.npcSheet.increaseArmor')}
				data-tooltip={game.i18n.localize('NIMBLE.npcSheet.increaseArmor')}
				disabled={actor.reactive.system.armor === 'heavy'}
				onclick={() => updateArmorCategory('increase')}
			>
				+
			</button>
		</section>
	</section>

	<header class="nimble-sheet__static nimble-sheet__static--npc-features">
		<h4 class="nimble-heading" data-heading-variant="section">
			<span class="nimble-features-breadcrumb">
				{#if visibleCategory}
					<button
						class="nimble-features-breadcrumb__item nimble-features-breadcrumb__item--clickable"
						type="button"
						onclick={() => {
							if (scrollContainer) {
								scrollContainer.scrollTop = 0;
							}
						}}
					>
						{game.i18n.localize('NIMBLE.npcSheet.features')}
					</button>
				{:else}
					<span class="nimble-features-breadcrumb__item">
						{game.i18n.localize('NIMBLE.npcSheet.features')}
					</span>
				{/if}
				{#if visibleCategory && visibleCategory !== 'feature'}
					<span class="nimble-features-breadcrumb__separator">→</span>
					<span class="nimble-features-breadcrumb__item nimble-features-breadcrumb__item--current">
						{monsterFeatureTypes[visibleCategory] ?? visibleCategory}
					</span>
				{/if}
			</span>
			{#if isEditable}
				<button
					class="nimble-button fa-solid fa-plus"
					data-button-variant="basic"
					type="button"
					aria-label={game.i18n.localize('NIMBLE.npcSheet.createFeature')}
					data-tooltip={game.i18n.localize('NIMBLE.npcSheet.createFeature')}
					onclick={createItem}
				></button>
			{/if}
			{#if Object.entries(categorizedItems).length > 0}
				<span
					class="nimble-button"
					style="margin-left: auto;"
					role="button"
					tabindex="0"
					data-button-variant="icon"
					aria-label={allCollapsed
						? game.i18n.localize('NIMBLE.npcSheet.expandAllDescriptions')
						: game.i18n.localize('NIMBLE.npcSheet.collapseAllDescriptions')}
					data-tooltip={allCollapsed
						? game.i18n.localize('NIMBLE.npcSheet.expandAllDescriptions')
						: game.i18n.localize('NIMBLE.npcSheet.collapseAllDescriptions')}
					onclick={() => {
						const newState = !allCollapsed;
						items.forEach((item) => toggleItemCollapsed(item, newState));
					}}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							const newState = !allCollapsed;
							items.forEach((item) => toggleItemCollapsed(item, newState));
						}
					}}
				>
					<i class="fa-solid {allCollapsed ? 'fa-expand' : 'fa-compress'}"></i>
				</span>
			{/if}
		</h4>
	</header>

	<section
		class="nimble-sheet__body nimble-sheet__body--player-character"
		use:registerScrollContainer
	>
		{#if Object.entries(categorizedItems).length > 0}
			{#each Object.entries(categorizedItems).sort(sortItemCategories) as [categoryName, itemCategory]}
				<section class="nimble-monster-sheet-section" data-category={categoryName}>
					{#if categoryName != 'feature'}
						<!-- Non-sticky category label for visual separation -->
						<div class="nimble-monster-category-label">
							<span class="nimble-monster-category-label__text">
								{monsterFeatureTypes[categoryName] ?? categoryName}
							</span>
						</div>
					{/if}

					<ul
						class="nimble-item-list"
						ondragover={(event) => {
							if (event.dataTransfer.types.includes('nimble/reorder')) event.preventDefault();
						}}
					>
						{#if categoryName === 'action'}
							<!-- Flat list rendering the action category with unified drag-drop -->
							{#each flatActionList as entry (entry.item.reactive._id)}
								{@const metadata = getFeatureMetadata(entry.item)}
								{#if entry.isAttackSequence}
									{@render attackSequenceHeader(entry.item)}
								{:else}
									{@render actionItemCard(entry.item, metadata, entry.parentId)}
								{/if}
							{/each}
						{:else}
							<!-- Standard rendering for other categories -->
							{#each sortItems(itemCategory) as item (item.reactive._id)}
								{@const metadata = getFeatureMetadata(item)}
								{#if isHeaderItem(item)}
									<!-- Render as header text instead of a card -->
									<li class="nimble-monster-feature-header">
										<span class="nimble-monster-feature-header__text">{item.reactive.name}</span>
										{#if isEditable}
											<button
												class="nimble-button"
												data-button-variant="icon"
												type="button"
												aria-label={game.i18n.format('NIMBLE.npcSheet.configureItem', {
													name: item.reactive.name,
												})}
												onclick={(event) => {
													event.stopPropagation();
													configureItem(event, item.reactive._id);
												}}
											>
												<i class="fa-solid fa-edit"></i>
											</button>
											<button
												class="nimble-button"
												data-button-variant="icon"
												type="button"
												aria-label={game.i18n.format('NIMBLE.npcSheet.deleteItem', {
													name: item.reactive.name,
												})}
												onclick={(event) => {
													event.stopPropagation();
													deleteItem(event, item.reactive._id);
												}}
											>
												<i class="fa-solid fa-trash"></i>
											</button>
										{/if}
									</li>
								{:else}
									{@render standardItemCard(item, metadata)}
								{/if}
							{/each}
						{/if}
					</ul>
				</section>
			{/each}
		{:else}
			<section class="nimble-monster-sheet-section">
				<p>{creatureFeatures.noFeatures}</p>
			</section>
		{/if}

		<section class="nimble-monster-sheet-section">
			<MovementSpeed {actor} showDefaultSpeed={false} />
		</section>
	</section>
</section>

{#snippet attackSequenceHeader(item)}
	{@const itemId = item.reactive?._id || item._id}
	<div
		class="nimble-monster-feature-wrapper nimble-attack-sequence-item"
		role="group"
		class:nimble-monster-feature-wrapper--drag-over-above={dragOverItemId === itemId &&
			dragOverPosition === 'above'}
		class:nimble-monster-feature-wrapper--drag-over-below={dragOverItemId === itemId &&
			dragOverPosition === 'below'}
		class:nimble-monster-feature-wrapper--will-nest={dragOverItemId === itemId &&
			dragOverPosition === 'below' &&
			draggedItemCategory === 'action' &&
			!draggedItemIsAttackSequence}
		draggable={isEditable}
		ondragstart={(event) => {
			event.dataTransfer.setData('nimble/reorder', itemId);
			draggedItemCategory = 'action'; // Use 'action' category for unified drag-drop
			draggedItemIsAttackSequence = true;
			sheet?._onDragStart?.(event);
		}}
		ondragover={(event) => {
			// Only allow items from the action category
			if (draggedItemCategory !== 'action') return;

			// Attack sequences can only drop on other attack sequences or above orphan actions
			if (draggedItemIsAttackSequence) {
				event.preventDefault();
				dragOverItemId = itemId;
				const rect = event.currentTarget.getBoundingClientRect();
				const midpoint = rect.top + rect.height / 2;
				dragOverPosition = event.clientY < midpoint ? 'above' : 'below';
				dragOverTargetParent = null; // Attack sequences never get a parent
			} else {
				event.preventDefault();
				dragOverItemId = itemId;
				const rect = event.currentTarget.getBoundingClientRect();
				const midpoint = rect.top + rect.height / 2;
				dragOverPosition = event.clientY < midpoint ? 'above' : 'below';
				// Calculate what parent the dragged item would have
				dragOverTargetParent = getDropTargetParent(flatActionList, itemId, dragOverPosition);
			}
		}}
		ondragleave={(event) => {
			if (event.currentTarget.contains(event.relatedTarget)) return;
			if (dragOverItemId === itemId) {
				dragOverItemId = null;
				dragOverPosition = null;
				dragOverTargetParent = null;
			}
		}}
		ondragend={() => {
			dragOverItemId = null;
			dragOverPosition = null;
			draggedItemCategory = null;
			dragOverTargetParent = null;
			draggedItemIsAttackSequence = false;
		}}
		ondrop={(event) => {
			const position = dragOverPosition;
			const newParentId = dragOverTargetParent;
			dragOverItemId = null;
			dragOverPosition = null;
			draggedItemCategory = null;
			dragOverTargetParent = null;
			draggedItemIsAttackSequence = false;
			handleDrop(event, itemId, position, newParentId);
		}}
	>
		<div class="nimble-attack-sequence-description">
			{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.reactive?.system?.description || item.system?.description || '') then featureDescription}
				{#if featureDescription}
					{@html featureDescription}
				{/if}
			{/await}
		</div>
		{#if isEditable}
			{@const itemName = item.reactive?.name || item.name}
			<span class="nimble-attack-sequence-actions">
				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={game.i18n.format('NIMBLE.npcSheet.configureItem', {
						name: itemName,
					})}
					onclick={(event) => configureItem(event, itemId)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={game.i18n.format('NIMBLE.npcSheet.deleteItem', {
						name: itemName,
					})}
					onclick={(event) => deleteItem(event, itemId)}
				>
					<i class="fa-solid fa-trash"></i>
				</button>
			</span>
		{/if}
	</div>
{/snippet}

{#snippet actionItemCard(item, metadata, parentId)}
	<div
		class="nimble-monster-feature-wrapper"
		role="group"
		class:nimble-monster-feature-wrapper--has-parent={parentId}
		class:nimble-monster-feature-wrapper--drag-over-above={dragOverItemId === item.reactive._id &&
			dragOverPosition === 'above' &&
			!(draggedItemIsAttackSequence && parentId)}
		class:nimble-monster-feature-wrapper--drag-over-below={dragOverItemId === item.reactive._id &&
			dragOverPosition === 'below' &&
			!(draggedItemIsAttackSequence && parentId)}
		class:nimble-monster-feature-wrapper--will-nest={dragOverItemId === item.reactive._id &&
			dragOverTargetParent &&
			dragOverTargetParent !== parentId &&
			!draggedItemIsAttackSequence}
		class:nimble-monster-feature-wrapper--will-unnest={dragOverItemId === item.reactive._id &&
			!dragOverTargetParent &&
			parentId &&
			!draggedItemIsAttackSequence}
		draggable={isEditable}
		ondragstart={(event) => {
			event.dataTransfer.setData('nimble/reorder', item.reactive._id);
			draggedItemCategory = 'action'; // Use unified 'action' category
			draggedItemIsAttackSequence = false;
			sheet?._onDragStart?.(event);
		}}
		ondragover={(event) => {
			// Only allow items from the action category
			if (draggedItemCategory !== 'action') return;

			// Attack sequences can't drop on child actions (actions with a parent)
			if (draggedItemIsAttackSequence && parentId) {
				// Don't show drop indicator - not a valid drop target
				return;
			}

			event.preventDefault();
			dragOverItemId = item.reactive._id;
			const rect = event.currentTarget.getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;
			dragOverPosition = event.clientY < midpoint ? 'above' : 'below';

			if (draggedItemIsAttackSequence) {
				// Attack sequences never get a parent
				dragOverTargetParent = null;
			} else {
				// Calculate what parent the dragged item would have
				dragOverTargetParent = getDropTargetParent(
					flatActionList,
					item.reactive._id,
					dragOverPosition,
				);
			}
		}}
		ondragleave={(event) => {
			if (event.currentTarget.contains(event.relatedTarget)) return;
			if (dragOverItemId === item.reactive._id) {
				dragOverItemId = null;
				dragOverPosition = null;
				dragOverTargetParent = null;
			}
		}}
		ondragend={() => {
			dragOverItemId = null;
			dragOverPosition = null;
			draggedItemCategory = null;
			dragOverTargetParent = null;
			draggedItemIsAttackSequence = false;
		}}
		ondrop={(event) => {
			// Attack sequences can't drop on child actions
			if (draggedItemIsAttackSequence && parentId) {
				return;
			}

			const position = dragOverPosition;
			const newParentId = dragOverTargetParent;
			dragOverItemId = null;
			dragOverPosition = null;
			draggedItemCategory = null;
			dragOverTargetParent = null;
			draggedItemIsAttackSequence = false;
			handleDrop(event, item.reactive._id, position, newParentId);
		}}
	>
		<li
			class="nimble-document-card nimble-document-card--no-meta nimble-document-card--monster-sheet"
			class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
			class:nimble-document-card--no-meta={!metadata}
			data-item-id={item.reactive._id}
		>
			<header class="u-semantic-only">
				<button
					class="nimble-document-card__content"
					type="button"
					data-tooltip={prepareItemTooltip(item)}
					data-tooltip-class="nimble-tooltip nimble-tooltip--item"
					data-tooltip-direction="LEFT"
					onclick={() => actor.activateItem(item.reactive._id)}
				>
					{#if showEmbeddedDocumentImages}
						<img class="nimble-document-card__img" src={item.reactive.img} alt="" />
					{/if}

					<span class="nimble-document-card__indicator">
						{#if item.reactive.system?.activation?.effects?.length > 0}
							<i class="fa-solid fa-dice-d20"></i>
						{:else}
							<i class="fa-solid fa-comment"></i>
						{/if}
					</span>

					<span class="nimble-document-card__name nimble-heading" data-heading-variant="item">
						{item.reactive.name}
					</span>
				</button>

				<span class="nimble-document-card__actions">
					{#if getReachRangeLabel(item)}
						<span class="nimble-document-card__reach-range">
							{getReachRangeLabel(item)}
						</span>
					{/if}

					{#if isEditable}
						<button
							class="nimble-button"
							data-button-variant="icon"
							type="button"
							aria-label={game.i18n.format('NIMBLE.npcSheet.configureItem', {
								name: item.reactive.name,
							})}
							onclick={(event) => configureItem(event, item.reactive._id)}
						>
							<i class="fa-solid fa-edit"></i>
						</button>

						<button
							class="nimble-button"
							data-button-variant="icon"
							type="button"
							aria-label={game.i18n.format('NIMBLE.npcSheet.deleteItem', {
								name: item.reactive.name,
							})}
							onclick={(event) => deleteItem(event, item.reactive._id)}
						>
							<i class="fa-solid fa-trash"></i>
						</button>
					{/if}

					<span
						class="nimble-button nimble-collapse-toggle"
						class:nimble-collapse-toggle--collapsed={getItemCollapsed(item)}
						role="button"
						tabindex="0"
						data-button-variant="icon"
						aria-label={getItemCollapsed(item)
							? game.i18n.format('NIMBLE.npcSheet.revealDescription', {
									name: item.reactive.name,
								})
							: game.i18n.format('NIMBLE.npcSheet.collapseDescription', {
									name: item.reactive.name,
								})}
						data-tooltip={getItemCollapsed(item)
							? creatureFeatures.expand
							: creatureFeatures.collapse}
						data-tooltip-direction="DOWN"
						data-tooltip-class="nimble-tooltip nimble-tooltip--compact"
						onclick={(event) => {
							const wasCollapsed = getItemCollapsed(item);
							toggleItemCollapsed(item, !wasCollapsed);
							game.tooltip.deactivate();
							requestAnimationFrame(() => {
								game.tooltip.activate(event.currentTarget, {
									text: wasCollapsed ? creatureFeatures.collapse : creatureFeatures.expand,
									direction: 'DOWN',
									cssClass: 'nimble-tooltip nimble-tooltip--compact',
								});
							});
						}}
						onkeydown={(event) => {
							if (event.key === 'Space' || event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								toggleItemCollapsed(item, !getItemCollapsed(item));
							}
						}}
					>
						<i class="fa-solid fa-chevron-up"></i>
					</span>
				</span>
			</header>
		</li>
		<div
			class="nimble-monster-feature-description-wrapper"
			class:nimble-monster-feature-description-wrapper--collapsed={getItemCollapsed(item)}
		>
			<div class="nimble-monster-feature-description">
				{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description) then featureDescription}
					{#if featureDescription}
						{@html featureDescription}
					{/if}
				{/await}
			</div>
		</div>
	</div>
{/snippet}

{#snippet standardItemCard(item, metadata)}
	<div
		class="nimble-monster-feature-wrapper"
		role="group"
		class:nimble-monster-feature-wrapper--drag-over-above={dragOverItemId === item.reactive._id &&
			dragOverPosition === 'above'}
		class:nimble-monster-feature-wrapper--drag-over-below={dragOverItemId === item.reactive._id &&
			dragOverPosition === 'below'}
		draggable={isEditable}
		ondragstart={(event) => {
			event.dataTransfer.setData('nimble/reorder', item.reactive._id);
			draggedItemCategory = mapMonsterFeatureToType(item);
			sheet?._onDragStart?.(event);
		}}
		ondragover={(event) => {
			const targetCategory = mapMonsterFeatureToType(item);
			if (draggedItemCategory && draggedItemCategory !== targetCategory) return;

			event.preventDefault();
			dragOverItemId = item.reactive._id;
			const rect = event.currentTarget.getBoundingClientRect();
			const midpoint = rect.top + rect.height / 2;
			dragOverPosition = event.clientY < midpoint ? 'above' : 'below';
		}}
		ondragleave={(event) => {
			if (event.currentTarget.contains(event.relatedTarget)) return;
			if (dragOverItemId === item.reactive._id) {
				dragOverItemId = null;
				dragOverPosition = null;
			}
		}}
		ondragend={() => {
			dragOverItemId = null;
			dragOverPosition = null;
			draggedItemCategory = null;
		}}
		ondrop={(event) => {
			const position = dragOverPosition;
			dragOverItemId = null;
			dragOverPosition = null;
			draggedItemCategory = null;
			handleDrop(event, item.reactive._id, position);
		}}
	>
		<li
			class="nimble-document-card nimble-document-card--no-meta nimble-document-card--monster-sheet"
			class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
			class:nimble-document-card--no-meta={!metadata}
			data-item-id={item.reactive._id}
		>
			<header class="u-semantic-only">
				<button
					class="nimble-document-card__content"
					type="button"
					data-tooltip={prepareItemTooltip(item)}
					data-tooltip-class="nimble-tooltip nimble-tooltip--item"
					data-tooltip-direction="LEFT"
					onclick={() => actor.activateItem(item.reactive._id)}
				>
					{#if showEmbeddedDocumentImages}
						<img class="nimble-document-card__img" src={item.reactive.img} alt="" />
					{/if}

					<span class="nimble-document-card__indicator">
						{#if item.reactive.system?.activation?.effects?.length > 0}
							<i class="fa-solid fa-dice-d20"></i>
						{:else}
							<i class="fa-solid fa-comment"></i>
						{/if}
					</span>

					<span class="nimble-document-card__name nimble-heading" data-heading-variant="item">
						{item.reactive.name}
					</span>
				</button>

				<span class="nimble-document-card__actions">
					{#if getReachRangeLabel(item)}
						<span class="nimble-document-card__reach-range">
							{getReachRangeLabel(item)}
						</span>
					{/if}

					{#if isEditable}
						<button
							class="nimble-button"
							data-button-variant="icon"
							type="button"
							aria-label={game.i18n.format('NIMBLE.npcSheet.configureItem', {
								name: item.reactive.name,
							})}
							onclick={(event) => configureItem(event, item.reactive._id)}
						>
							<i class="fa-solid fa-edit"></i>
						</button>

						<button
							class="nimble-button"
							data-button-variant="icon"
							type="button"
							aria-label={game.i18n.format('NIMBLE.npcSheet.deleteItem', {
								name: item.reactive.name,
							})}
							onclick={(event) => deleteItem(event, item.reactive._id)}
						>
							<i class="fa-solid fa-trash"></i>
						</button>
					{/if}

					<span
						class="nimble-button nimble-collapse-toggle"
						class:nimble-collapse-toggle--collapsed={getItemCollapsed(item)}
						role="button"
						tabindex="0"
						data-button-variant="icon"
						aria-label={getItemCollapsed(item)
							? game.i18n.format('NIMBLE.npcSheet.revealDescription', {
									name: item.reactive.name,
								})
							: game.i18n.format('NIMBLE.npcSheet.collapseDescription', {
									name: item.reactive.name,
								})}
						data-tooltip={getItemCollapsed(item)
							? creatureFeatures.expand
							: creatureFeatures.collapse}
						data-tooltip-direction="DOWN"
						data-tooltip-class="nimble-tooltip nimble-tooltip--compact"
						onclick={(event) => {
							const wasCollapsed = getItemCollapsed(item);
							toggleItemCollapsed(item, !wasCollapsed);
							game.tooltip.deactivate();
							requestAnimationFrame(() => {
								game.tooltip.activate(event.currentTarget, {
									text: wasCollapsed ? creatureFeatures.collapse : creatureFeatures.expand,
									direction: 'DOWN',
									cssClass: 'nimble-tooltip nimble-tooltip--compact',
								});
							});
						}}
						onkeydown={(event) => {
							if (event.key === 'Space' || event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								toggleItemCollapsed(item, !getItemCollapsed(item));
							}
						}}
					>
						<i class="fa-solid fa-chevron-up"></i>
					</span>
				</span>
			</header>
		</li>
		<div
			class="nimble-monster-feature-description-wrapper"
			class:nimble-monster-feature-description-wrapper--collapsed={getItemCollapsed(item)}
		>
			<div class="nimble-monster-feature-description">
				{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description) then featureDescription}
					{#if featureDescription}
						{@html featureDescription}
					{/if}
				{/await}
			</div>
		</div>
	</div>
{/snippet}

<style lang="scss">
	.nimble-document-card__reach-range {
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		color: var(--nimble-muted-text-color, hsl(41, 18%, 40%));
		padding: 0.125rem 0.375rem;
		background: hsl(41, 18%, 54%, 15%);
		border-radius: 3px;
		white-space: nowrap;
	}

	// Animated collapse toggle caret
	.nimble-collapse-toggle {
		i {
			display: inline-block;
			transition: transform 250ms ease-out;
		}

		&--collapsed i {
			transform: rotateX(180deg);
		}
	}

	// Ensure monster sheet cards have a solid background for drag ghost
	:global(.nimble-document-card--monster-sheet) {
		background: var(--nimble-card-background-color, hsl(41, 30%, 94%));
	}

	// Darken indicator when hovering the clickable content area
	:global(.nimble-document-card__content:hover) :global(.nimble-document-card__indicator) {
		color: var(--nimble-accent-color, hsl(210, 70%, 50%));
	}

	// Feature wrapper for drag-drop
	.nimble-monster-feature-wrapper {
		position: relative;
	}

	// Child actions (under an attackSequence) get visual indentation
	.nimble-monster-feature-wrapper--has-parent {
		margin-left: 1rem;
		padding-left: 0.5rem;
		border-left: 2px solid hsl(41, 18%, 54%, 30%);
	}

	// Drop indicator styling - shows line above or below target
	.nimble-monster-feature-wrapper--drag-over-above::before {
		content: '';
		position: absolute;
		top: -2px;
		left: 0;
		right: 0;
		height: 4px;
		background: hsl(145, 80%, 40%);
		border-radius: 2px;
		z-index: 10;
	}

	.nimble-monster-feature-wrapper--drag-over-below::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		right: 0;
		height: 4px;
		background: hsl(145, 80%, 40%);
		border-radius: 2px;
		z-index: 10;
	}

	// Visual indicator when item will be nested under an attackSequence
	.nimble-monster-feature-wrapper--will-nest {
		&::after {
			// Indent the drop indicator to show nesting
			left: 1rem !important;
			background: hsl(210, 80%, 50%) !important;
		}

		&::before {
			left: 1rem !important;
			background: hsl(210, 80%, 50%) !important;
		}
	}

	// Visual indicator when item will be unnested (become orphan)
	.nimble-monster-feature-wrapper--will-unnest {
		&::after {
			// Extend the drop indicator to full width to show unnesting
			left: -1rem !important;
			background: hsl(35, 80%, 50%) !important;
		}

		&::before {
			left: -1rem !important;
			background: hsl(35, 80%, 50%) !important;
		}
	}

	.nimble-item-list {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.nimble-monster-feature-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		margin: 0;
		font-weight: 600;
		line-height: 1.5;
		color: var(--nimble-text-color);
		background: hsl(41, 18%, 54%, 15%);
		border: 1px solid hsl(41, 18%, 54%, 25%);
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		font-size: var(--nimble-lg-text);

		&__text {
			flex: 1;
		}

		// First card after a header should connect seamlessly
		+ .nimble-monster-feature-wrapper > .nimble-document-card {
			border-top-left-radius: 0;
			border-top-right-radius: 0;
		}
	}

	.nimble-monster-feature-description-wrapper {
		overflow: hidden;
	}

	.nimble-monster-feature-description {
		padding: 0.5rem;
		margin-top: -0.125rem;
		font-size: var(--nimble-md-text);
		background: var(--nimble-card-background, transparent);
		border: 1px solid hsl(41, 18%, 54%, 25%);
		border-top: none;
		border-radius: 0 0 4px 4px;
		overflow: hidden;
		// Animate all properties
		transition:
			max-height 250ms ease-out,
			padding 250ms ease-out,
			margin 250ms ease-out,
			opacity 250ms ease-out,
			border-color 250ms ease-out;
		max-height: 500px; // Large enough for most content
		opacity: 1;

		.nimble-monster-feature-description-wrapper--collapsed & {
			max-height: 0;
			padding-block: 0;
			margin-top: 0;
			border-color: transparent;
			opacity: 0;
		}
	}

	// Attack sequence item styling (description only, smaller text)
	.nimble-attack-sequence-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: hsl(41, 18%, 54%, 10%);
		border: 1px solid hsl(41, 18%, 54%, 20%);
		border-radius: 4px;
		margin-bottom: 0.25rem;
	}

	.nimble-attack-sequence-description {
		flex: 1;
		font-size: var(--nimble-sm-text);
		line-height: 1.4;
		color: var(--nimble-muted-text-color, hsl(41, 18%, 40%));
		font-style: italic;

		// Remove default paragraph margins
		:global(p) {
			margin: 0;
		}

		// Dark mode support
		:global(.theme-dark) & {
			color: var(--nimble-muted-text-color, hsl(41, 30%, 70%));
		}
	}

	// Attack sequence item dark mode support
	:global(.theme-dark) .nimble-attack-sequence-item {
		background: hsl(41, 18%, 20%, 30%);
		border-color: hsl(41, 18%, 40%, 30%);
	}

	.nimble-attack-sequence-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 150ms ease-out;

		.nimble-attack-sequence-item:hover & {
			opacity: 1;
		}
	}

	// Breadcrumb navigation in the features header
	.nimble-features-breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.375rem;

		&__item {
			&--clickable {
				// Reset button styles
				background: none;
				border: none;
				padding: 0;
				margin: 0;
				font: inherit;
				color: inherit;
				cursor: pointer;
				opacity: 0.7;
				transition: opacity 150ms ease;

				&:hover {
					opacity: 1;
					text-decoration: underline;
				}
			}

			&--current {
				font-weight: 700;
			}
		}

		&__separator {
			opacity: 0.5;
			font-size: 0.875em;
		}
	}

	// Non-sticky category label (visual separator only)
	.nimble-monster-category-label {
		margin: 0.5rem 0 0.25rem;
		padding: 0.25rem 0;

		&__text {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-muted-text-color, hsl(41, 18%, 50%));
		}
	}

	.nimble-other-attribute-wrapper {
		position: relative;

		&:hover .nimble-armor-config-button {
			--nimble-button-display: flex;
		}
	}

	.nimble-armor-config-button {
		--nimble-button-display: none;
		--nimble-button-padding: 0;
		--nimble-button-width: 0.75rem;

		position: absolute;
		bottom: 0;
		width: 0.5rem;
		height: 0.5rem;
		padding: 0;
		line-height: 1;
		border: none;
		background-color: transparent;
		cursor: pointer;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-text-color);
		transition: color 0.2s ease-in-out;

		&--decrement {
			left: 0.25rem;
		}

		&--increment {
			right: 0.25rem;
		}

		&:hover {
			color: var(--nimble-primary-color);
		}
	}

	.nimble-monster-sheet-section {
		padding: 0.25rem 0.5rem 0.25rem;

		&:first-of-type {
			padding: 0.75rem 0.5rem 0.75rem !important;
		}
		&:not(:last-of-type) {
			padding: 0 0.5rem 0.75rem;
		}
		&:last-of-type {
			padding: 0 0.5rem 0.75rem;
		}

		&--defenses {
			display: grid;
			grid-template-columns: 1fr 4.2rem;
			grid-template-areas: 'savingThrows armor';
		}
	}

	.nimble-sheet__body--player-character {
		gap: 0.25rem;
	}

	:global(.system-nimble) {
		.nimble-sheet__static {
		}
		// Features header - sticky when scrolling
		// Font size for "Features" heading is defined here (line ~654)
		// This styles the h4.nimble-heading inside the header at line ~263
		:global(.nimble-sheet__static--npc-features) {
			border-top: 1px solid var(--color-border);
			border-bottom: 1px solid var(--color-border);
			margin: 0;
			padding: 0.5rem 1rem !important;
			position: sticky;
			top: 0;
			z-index: 20;
			background: var(--nimble-sheet-background);

			.nimble-heading {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				width: 100%;
				font-size: var(--nimble-lg-text);
				font-weight: 700;
				letter-spacing: 0.02em;
			}
		}
	}
</style>
