<script lang="ts">
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import type PlayerCharacterSheet from '../../../documents/sheets/PlayerCharacterSheet.svelte.js';
	import type { Readable } from 'svelte/store';
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import { getContext } from 'svelte';
	import shouldFlashDroppedItem from '../../../utils/shouldFlashDroppedItem.js';
	import { getPools, getPoolsForItem } from '../../../utils/chargePool/chargePoolSync.js';
	import { SYSTEM_ID } from '#system';
	import {
		DROP_ITEM_FLASH_ANIMATION_NAME,
		getDroppedItemFlashIds,
		type SheetDropItemFlashState,
	} from '../dropItemFlashState.js';

	import {
		buildFeatureSections,
		type FeatureSection,
		formatGroupName,
		getEffectiveLevel,
	} from './PlayerCharacterFeaturesTabUtils.js';

	import SearchBar from '../components/SearchBar.svelte';
	import ChargeIndicator from '../../components/ChargeIndicator.svelte';

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

	function getSectionHeading(section: FeatureSection<unknown>): string {
		if (section.kind === 'group') return formatGroupName(section.key);

		return featureTypeHeadings[section.key] ?? formatGroupName(section.key);
	}

	function handleDropFlashAnimationEnd(event: AnimationEvent, itemId: string) {
		if (event.animationName !== DROP_ITEM_FLASH_ANIMATION_NAME) return;
		sheet.clearDroppedItemFlash(itemId);
	}

	// Local collapse state — resets when the sheet is closed/reopened
	let collapsedState = $state<Record<string, boolean>>({});
	let allExpanded = $state(false);

	function toggleAllExpanded(): void {
		allExpanded = !allExpanded;
		collapsedState = {};
	}

	function toggleCollapsed(itemId: string): void {
		collapsedState[itemId] = !isCollapsed(itemId);
	}

	function isCollapsed(itemId: string): boolean {
		if (itemId in collapsedState) return collapsedState[itemId];
		return !allExpanded;
	}

	// IMPORTANT: The order of these strings is used for sorting purposes.
	const validTypes = [
		'class',
		'subclass',
		'feature',
		'ancestry',
		'ancestryBonus',
		'background',
		'boon',
	];
	const { featureTypeHeadings } = CONFIG.NIMBLE;

	let actor = getContext<NimbleCharacter>('actor');
	let sheet = getContext<PlayerCharacterSheet>('application');
	const sheetState = getContext<SheetDropItemFlashState>('sheetState');
	const editingEnabledStore = getContext<Readable<boolean>>('editingEnabled');
	let droppedItemFlashIds = $derived(new Set(getDroppedItemFlashIds(sheetState)));
	let editingEnabled = $derived($editingEnabledStore ?? true);

	let searchTerm = $state('');
	let items = $derived(filterItems(actor.reactive, validTypes, searchTerm));
	let sections = $derived(buildFeatureSections(items, validTypes));

	// Settings
	let flags = $derived(actor.reactive.flags[SYSTEM_ID]);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

	// All charge pools for the actor
	let allPools = $derived(getPools(actor.reactive));

	function getItemPools(itemId: string) {
		return getPoolsForItem(actor.reactive, itemId, allPools);
	}
</script>

{#snippet featureCard(item)}
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
					<img class="nimble-feature-card__img" src={item.reactive.img} alt={item.reactive.name} />
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

			<ChargeIndicator pools={getItemPools(item.reactive._id)} {actor} itemId={item.reactive._id} />

			{#if getEffectiveLevel(item) !== Infinity}
				<span class="nimble-feature-card__level">Lv. {getEffectiveLevel(item)}</span>
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
{/snippet}

<header class="nimble-sheet__static nimble-sheet__static--features">
	<div class="nimble-search-wrapper">
		<SearchBar bind:searchTerm />

		<button
			class="nimble-button"
			data-button-variant="basic"
			type="button"
			aria-label={allExpanded ? 'Collapse All' : 'Expand All'}
			data-tooltip={allExpanded ? 'Collapse All' : 'Expand All'}
			onclick={toggleAllExpanded}
		>
			<i class="fa-solid {allExpanded ? 'fa-compress' : 'fa-expand'}"></i>
		</button>

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
	{#each sections as section (`${section.kind}:${section.key}`)}
		<div>
			<header>
				<h3 class="nimble-heading" data-heading-variant="section">
					{getSectionHeading(section)}
				</h3>
			</header>

			<ul class="nimble-item-list">
				{#each section.items as item (item.reactive._id)}
					{@render featureCard(item)}
				{/each}
			</ul>

			{#if section.blocks.length}
				<div class="nimble-nested-blocks">
					{#each section.blocks as block (block.key)}
						{#if block.label}
							<h4 class="nimble-heading nimble-group-heading" data-heading-variant="section">
								{block.label}
							</h4>
						{/if}

						<ul class="nimble-item-list nimble-item-list--sublist">
							{#each block.items as item (item.reactive._id)}
								{@render featureCard(item)}
							{/each}
						</ul>
					{/each}
				</div>
			{/if}
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

			& + & {
				margin-block-start: 0.5rem;
			}
		}
	}

	// The rail brackets everything the parent card brings with it, so a class reads as one
	// scope however many groups it offers.
	.nimble-nested-blocks {
		margin-inline-start: 0.5rem;
		padding-inline-start: 0.625rem;
		border-inline-start: 2px solid
			color-mix(in srgb, var(--nimble-medium-text-color) 40%, transparent);
		border-end-start-radius: 2px;
	}

	.nimble-group-heading {
		// The global .nimble-heading rule sets the margin shorthand, so feed it the variable
		// it reads rather than setting margin-inline-start, which it would reset to 0.
		--nimble-heading-margin: 0.625rem 0 0.25rem 0;
		--nimble-heading-size: var(--nimble-xs-text);
		--nimble-heading-color: var(--nimble-medium-text-color);
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
		background-color: var(--nimble-artwork-backdrop);
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
