<script lang="ts">
	import { FALSE, TRUE } from 'sass';
	import { getContext, onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import sortItems from '../../../utils/sortItems.js';
	import ArmorClass from '../components/ArmorClass.svelte';
	import Editor from '../components/Editor.svelte';
	import MonsterFeature from '../components/MonsterFeature.svelte';
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
			const itemType = mapMonsterFeatureToType(item);
			categories[itemType] ??= [];
			categories[itemType].push(item);
			return categories;
		}, {});
	}

	function sortItemCategories([categoryA], [categoryB]) {
		return validTypes.indexOf(categoryA) - validTypes.indexOf(categoryB);
	}

	const validTypes = ['feature', 'action', 'bloodied', 'lastStand'];

	function filterMonsterFeatures(actor) {
		return actor.items.filter((item) => {
			if (!validTypes.includes(item.system?.subtype)) return false;

			return item.name.toLocaleLowerCase();
		});
	}

	function mapMonsterFeatureToType(item) {
		return item.system?.subtype || 'feature';
	}

	function prepareItemTooltip(item) {
		return null;
	}

	function getFeatureMetadata(item) {
		return null;
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

	function getMonsterFeatureIcon(categoryName) {
		switch (categoryName) {
			case 'bloodied':
				return 'fa-solid fa-droplet';
			case 'last stand':
				return 'fa-solid fa-skull';
			case 'action':
				return 'fa-solid fa-bolt';
			default:
				return 'fa-solid fa-message';
		}
	}

	async function handleDrop(event, targetId) {
		const draggedId = event.dataTransfer.getData('nimble/reorder');
		if (!draggedId) return;

		event.preventDefault();

		const draggedItem = actor.items.get(draggedId);
		const targetItem = actor.items.get(targetId);
		if (!draggedItem || !targetItem) return;

		const draggedCategory = mapMonsterFeatureToType(draggedItem);
		const targetCategory = mapMonsterFeatureToType(targetItem);
		if (draggedCategory !== targetCategory) return;

		const categoryItems = categorizedItems[draggedCategory];
		const draggedIndex = categoryItems.findIndex((item) => item._id === draggedId);
		const targetIndex = categoryItems.findIndex((item) => item._id === targetId);
		if (draggedIndex === -1 || targetIndex === -1) return;

		const newItems = [...categoryItems];
		newItems.splice(draggedIndex, 1);
		newItems.splice(targetIndex, 0, draggedItem);

		const updates = newItems.map((item, index) => ({ _id: item._id, sort: index * 10000 }));
		await actor.updateEmbeddedDocuments('Item', updates);
	}

	function getArmorClassLabel(armor) {
		return npcArmorTypeAbbreviations[armor] ?? '-';
	}

	function handleEditorSave(event, updatePath, editState) {
		const target = event.target;

		if (!target) return;
		if (target.dataset?.action !== 'save') return;

		const editor = target.parentNode.closest(`[name="${updatePath}"]`);

		if (editor?.dataset?.documentUUID !== actor.uuid) return;

		bloodiedEffectInEditMode = false;
		lastStandEffectInEditMode = false;
		attackSequenceInEditMode = false;
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

	// Local state for collapsed items (used when document is not editable)
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
		console.log('setting local collapsed state', item.reactive._id, shouldCollapse);
		if (isEditable) {
			// If editable, persist to document
			item.reactive.update({ 'flags.nimble.collapsed': shouldCollapse });
		} else {
			// If not editable (viewing from compendium), use local state
			localCollapsedState.set(item.reactive._id, shouldCollapse);
		}
	}

	// Get collapsed state for an item
	function getItemCollapsed(item) {
		if (!isEditable && localCollapsedState.has(item.reactive._id)) {
			console.log(
				'getting local collapsed state',
				item.reactive._id,
				localCollapsedState.get(item.reactive._id),
			);
			return localCollapsedState.get(item.reactive._id);
		}
		return item.reactive.flags.nimble?.collapsed ?? false;
	}

	let features = $derived.by(() =>
		actor.reactive.items.filter((item) => !item.reactive.system.isAction),
	);

	let actions = $derived.by(() =>
		actor.reactive.items.filter((item) => item.reactive.system.isAction),
	);

	let bloodiedEffectInEditMode = $state(false);
	let lastStandEffectInEditMode = $state(false);
	let attackSequenceInEditMode = $state(false);

	let items = $derived(filterMonsterFeatures(actor.reactive));
	let categorizedItems = $derived(groupItemsByType(items));

	let flags = $derived(actor.reactive.flags.nimble);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

	let allCollapsed = $derived(items.every((item) => getItemCollapsed(item)));

	document.addEventListener('click', (event) =>
		handleEditorSave(event, 'system.attackSequence', attackSequenceInEditMode),
	);

	onDestroy(() => {
		document.removeEventListener('click', handleEditorSave);
	});
</script>

<section class="nimble-sheet__body nimble-sheet__body--npc">
	<section class="nimble-monster-sheet-section nimble-monster-sheet-section--defenses">
		<SavingThrows characterSavingThrows={actor.reactive.system.savingThrows} />

		<section class="nimble-other-attribute-wrapper" style="grid-area: armor;">
			<header class="nimble-section-header" data-header-alignment="center">
				<h3 class="nimble-heading" data-heading-variant="section">Armor</h3>
			</header>

			<ArmorClass armorClass={getArmorClassLabel(actor.reactive.system.attributes.armor)} />

			<button
				class="nimble-button nimble-armor-config-button nimble-armor-config-button--decrement"
				data-button-variant="basic"
				type="button"
				aria-label="Decrease Armor"
				data-tooltip="Decrease Armor"
				disabled={actor.reactive.system.armor === 'none'}
				onclick={() => updateArmorCategory('decrease')}
			>
				-
			</button>

			<button
				class="nimble-button nimble-armor-config-button nimble-armor-config-button--increment"
				data-button-variant="basic"
				type="button"
				aria-label="Increase Armor"
				data-tooltip="Increase Armor"
				disabled={actor.reactive.system.armor === 'heavy'}
				onclick={() => updateArmorCategory('increase')}
			>
				+
			</button>
		</section>
	</section>

	<header class="nimble-sheet__static nimble-sheet__static--npc-features">
		<h4 class="nimble-heading" data-heading-variant="section">
			Features
			{#if isEditable}
				<button
					class="nimble-button fa-solid fa-plus"
					data-button-variant="basic"
					type="button"
					aria-label="Create Feature"
					data-tooltip="Create Feature"
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
					aria-label={allCollapsed ? 'Expand all descriptions' : 'Collapse all descriptions'}
					data-tooltip={allCollapsed ? 'Expand all descriptions' : 'Collapse all descriptions'}
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

	<section class="nimble-sheet__body nimble-sheet__body--player-character">
		{#if Object.entries(categorizedItems).length > 0}
			{#each Object.entries(categorizedItems).sort(sortItemCategories) as [categoryName, itemCategory]}
				<section class="nimble-monster-sheet-section">
					{#if categoryName != 'feature'}
						<header class="nimble-monster-category-header">
							<h4 class="nimble-heading" data-heading-variant="section">
								{monsterFeatureTypes[categoryName] ?? categoryName}
							</h4>
						</header>
					{/if}
					{#if categoryName === 'action' && actor.reactive.type === 'soloMonster'}
						{#if attackSequenceInEditMode && isEditable}
							{#key actor.reactive.system.attackSequence}
								<div style="min-height: 150px;">
									<Editor
										editorOptions={{ compact: true, toggled: false, height: 150 }}
										field="system.attackSequence"
										content={actor.reactive.system.attackSequence ||
											creatureFeatures.actionSequence}
										document={actor}
									/>
								</div>
							{/key}
						{:else}
							<div
								class="nimble-monster-feature-header nimble-monster-feature-header--attack-sequence"
							>
								{#await TextEditor.enrichHTML(actor.reactive?.system?.attackSequence || creatureFeatures.actionSequence) then hintText}
									{#if hintText}
										<div class="nimble-monster-feature-header__text">
											{@html hintText}
										</div>
									{/if}
								{/await}
								{#if !attackSequenceInEditMode && isEditable}
									{#key actor.reactive.system.attackSequence}
										<button
											class="nimble-button"
											data-button-variant="icon"
											type="button"
											aria-label="Edit Attack Sequence"
											data-tooltip="Edit Attack Sequence"
											onclick={() => (attackSequenceInEditMode = true)}
										>
											<i class="fa-solid fa-edit"></i>
										</button>
									{/key}
								{/if}
							</div>
						{/if}
					{/if}

					<ul
						class="nimble-item-list"
						ondragover={(event) => {
							if (event.dataTransfer.types.includes('nimble/reorder')) event.preventDefault();
						}}
					>
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
											aria-label="Configure {item.reactive.name}"
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
											aria-label="Delete {item.reactive.name}"
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
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<li
									class="nimble-document-card nimble-document-card--no-meta nimble-document-card--monster-sheet"
									class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
									class:nimble-document-card--no-meta={!metadata}
									data-item-id={item.reactive._id}
									data-tooltip={prepareItemTooltip(item)}
									data-tooltip-class="nimble-tooltip nimble-tooltip--item"
									data-tooltip-direction="LEFT"
									draggable={isEditable}
									ondragstart={(event) => {
										event.dataTransfer.setData('nimble/reorder', item.reactive._id);
										sheet._onDragStart(event);
									}}
									ondrop={(event) => handleDrop(event, item.reactive._id)}
									onclick={() => {
										if (isEditable) actor.activateItem(item.reactive._id);
									}}
								>
									<header class="u-semantic-only">
										{#if showEmbeddedDocumentImages}
											<img
												class="nimble-document-card__img"
												src={item.reactive.img}
												alt={item.reactive.name}
											/>
										{/if}

										<h4
											class="nimble-document-card__name nimble-heading"
											data-heading-variant="item"
										>
											{item.reactive.name}
										</h4>

										{#if !getItemCollapsed(item)}
											<span
												class="nimble-button"
												role="button"
												tabindex="0"
												data-button-variant="icon"
												aria-label="Collapse description for {item.reactive.name}"
												onclick={(event) => {
													console.log('collapsing description for', item.reactive.name);
													event.stopPropagation();
													toggleItemCollapsed(item, true);
												}}
												onkeydown={(event) => {
													if (event.key === 'Space' || event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														toggleItemCollapsed(item, true);
													}
												}}
											>
												<i class="fa-solid fa-chevron-up"></i>
											</span>
										{:else}
											<span
												class="nimble-button"
												role="button"
												tabindex="0"
												data-button-variant="icon"
												aria-label="Reveal description for {item.reactive.name}"
												onclick={(event) => {
													console.log('revealing description for', item.reactive.name);
													event.stopPropagation();
													toggleItemCollapsed(item, false);
												}}
												onkeydown={(event) => {
													if (event.key === 'Space' || event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														toggleItemCollapsed(item, false);
													}
												}}
											>
												<i class="fa-solid fa-chevron-down"></i>
											</span>
										{/if}

										{#if isEditable}
											<button
												class="nimble-button"
												data-button-variant="icon"
												type="button"
												aria-label="Configure {item.reactive.name}"
												onclick={(event) => configureItem(event, item.reactive._id)}
											>
												<i class="fa-solid fa-edit"></i>
											</button>

											<button
												class="nimble-button"
												data-button-variant="icon"
												type="button"
												aria-label="Delete {item.reactive.name}"
												onclick={(event) => deleteItem(event, item.reactive._id)}
											>
												<i class="fa-solid fa-trash"></i>
											</button>
										{/if}
									</header>
								</li>
								{#if !getItemCollapsed(item)}
									<div class="nimble-monster-feature-description">
										{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description) then featureDescription}
											{#if featureDescription}
												{@html featureDescription}
											{/if}
										{/await}
									</div>
								{/if}
							{/if}
						{/each}
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

<style lang="scss">
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

		&--attack-sequence {
			font-size: var(--nimble-md-text);
		}

		// First card after a header should connect seamlessly
		+ .nimble-document-card {
			border-top-left-radius: 0;
			border-top-right-radius: 0;
		}
	}

	.nimble-monster-feature-description {
		padding: 0.5rem;
		margin-top: -0.125rem;
		font-size: var(--nimble-md-text);
		background: var(--nimble-card-background, transparent);
		border: 1px solid hsl(41, 18%, 54%, 25%);
		border-top: none;
		border-radius: 0 0 4px 4px;
	}

	// Category name header (Actions, Bloodied, Last Stand)
	.nimble-monster-category-header {
		margin: 0;
		padding: 1rem 0;
		border-top: 1px solid var(--color-border);
		border-bottom: 0;

		.nimble-heading {
			font-size: var(--nimble-md-text);
			font-weight: 700;
			letter-spacing: 0.02em;
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
		// Features header
		// Font size for "Features" heading is defined here (line ~654)
		// This styles the h4.nimble-heading inside the header at line ~263
		:global(.nimble-sheet__static--npc-features) {
			border-top: 1px solid var(--color-border);
			border-bottom: 1px solid var(--color-border);
			margin: 0;
			padding: 0.5rem 1rem !important;

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
