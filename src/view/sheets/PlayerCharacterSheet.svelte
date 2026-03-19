<script lang="ts">
	import { setContext, tick, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import ActionTracker from './components/ActionTracker.svelte';
	import HitDiceBar from './components/HitDiceBar.svelte';
	import HitPointBar from './components/HitPointBar.svelte';
	import ManaBar from './components/ManaBar.svelte';
	import { createPlayerCharacterSheetState } from './PlayerCharacterSheet.state.svelte.js';
	import { getDroppedItemFlashIds, type SheetDropItemFlashState } from './dropItemFlashState.js';
	import PlayerCharacterBioTab from './pages/PlayerCharacterBioTab.svelte';
	import PlayerCharacterConditionsTab from './pages/PlayerCharacterConditionsTab.svelte';
	import PlayerCharacterCoreTab from './pages/PlayerCharacterCoreTab.svelte';
	import PlayerCharacterFeaturesTab from './pages/PlayerCharacterFeaturesTab.svelte';
	import PlayerCharacterHeroicActionsTab from './pages/PlayerCharacterHeroicActionsTab.svelte';
	import PlayerCharacterInventoryTab from './pages/PlayerCharacterInventoryTab.svelte';
	import PlayerCharacterSettingsTab from './pages/PlayerCharacterSettingsTab.svelte';
	import PlayerCharacterSpellsTab from './pages/PlayerCharacterSpellsTab.svelte';

	function findLatestDroppedItemCard(rootElement: HTMLElement, droppedItemIds: string[]) {
		for (let i = droppedItemIds.length - 1; i >= 0; i--) {
			const itemId = droppedItemIds[i];
			const escapedItemId = globalThis.CSS?.escape ? globalThis.CSS.escape(itemId) : itemId;
			const droppedItemCard = rootElement.querySelector<HTMLElement>(
				`.nimble-sheet__body [data-item-id="${escapedItemId}"]`,
			);
			if (droppedItemCard) return droppedItemCard;
		}

		return null;
	}

	function scrollDroppedItemCardIntoView(droppedItemCard: HTMLElement) {
		const scrollContainer = droppedItemCard.closest<HTMLElement>('.nimble-sheet__body');
		if (!(scrollContainer instanceof HTMLElement)) return;

		const isScrollable = scrollContainer.scrollHeight > scrollContainer.clientHeight + 1;
		if (!isScrollable) return;

		const containerRect = scrollContainer.getBoundingClientRect();
		const itemRect = droppedItemCard.getBoundingClientRect();
		const isOutOfView = itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom;
		if (!isOutOfView) return;

		droppedItemCard.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
	}

	let { actor, sheet, state: appState } = $props();

	const playerCharacterSheetState = createPlayerCharacterSheetState({
		actor: () => actor,
		sheet: () => sheet,
		navigationComponents: {
			core: PlayerCharacterCoreTab,
			actions: PlayerCharacterHeroicActionsTab,
			conditions: PlayerCharacterConditionsTab,
			inventory: PlayerCharacterInventoryTab,
			features: PlayerCharacterFeaturesTab,
			spells: PlayerCharacterSpellsTab,
			bio: PlayerCharacterBioTab,
			settings: PlayerCharacterSettingsTab,
		},
	});

	const navigation = playerCharacterSheetState.navigation;
	let currentTab = $state(playerCharacterSheetState.currentTab);
	let isBloodied = $derived(playerCharacterSheetState.isBloodied);
	let classItem = $derived(playerCharacterSheetState.classItem);
	let wounds = $derived(playerCharacterSheetState.wounds);
	let mana = $derived(playerCharacterSheetState.mana);
	let hasMana = $derived(playerCharacterSheetState.hasMana);
	let actorImageXOffset = $derived(playerCharacterSheetState.actorImageXOffset);
	let actorImageYOffset = $derived(playerCharacterSheetState.actorImageYOffset);
	let actorImageScale = $derived(playerCharacterSheetState.actorImageScale);
	let editingEnabled = $derived(playerCharacterSheetState.editingEnabled);
	let metaData = $derived(playerCharacterSheetState.metaData);
	let hitDiceData = $derived(playerCharacterSheetState.hitDiceData);

	$effect(() => {
		playerCharacterSheetState.currentTab = currentTab;
	});

	$effect(() => {
		const sheetState = appState as SheetDropItemFlashState;
		const requestedTabName = sheetState.activePrimaryTab;
		if (typeof requestedTabName !== 'string' || requestedTabName.length < 1) return;

		const requestedTab = navigation.find((tab) => tab.name === requestedTabName);
		const didSwitchTab =
			!!requestedTab && !!currentTab?.name && currentTab.name !== requestedTab.name;
		if (requestedTab && didSwitchTab) {
			currentTab = requestedTab;
		}

		if (didSwitchTab) {
			const droppedItemIds = getDroppedItemFlashIds(sheetState);
			if (droppedItemIds.length > 0) {
				untrack(() => {
					sheetState.droppedItemFlashIds = [];
				});

				void tick().then(() => {
					const currentDroppedItemIds = getDroppedItemFlashIds(sheetState);
					sheetState.droppedItemFlashIds = Array.from(
						new Set([...currentDroppedItemIds, ...droppedItemIds]),
					);
				});
			}
		}

		untrack(() => {
			sheetState.activePrimaryTab = null;
		});
	});

	$effect(() => {
		const sheetState = appState as SheetDropItemFlashState;
		const activeTabName = currentTab?.name ?? '';
		const droppedItemIds = getDroppedItemFlashIds(sheetState);
		if (droppedItemIds.length < 1) {
			return;
		}
		if (activeTabName.length < 1) return;

		const rootElement = sheet?.element;
		if (!(rootElement instanceof HTMLElement)) return;

		const tryScrollToDroppedItem = (): boolean => {
			const droppedItemCard = findLatestDroppedItemCard(rootElement, droppedItemIds);
			if (!(droppedItemCard instanceof HTMLElement)) return false;
			scrollDroppedItemCardIntoView(droppedItemCard);
			return true;
		};

		if (tryScrollToDroppedItem()) return;

		const observer = new MutationObserver(() => {
			if (!tryScrollToDroppedItem()) return;
			observer.disconnect();
		});

		observer.observe(rootElement, {
			childList: true,
			subtree: true,
		});

		return () => {
			observer.disconnect();
		};
	});

	{
		const sheetStateRef = untrack(() => appState) as SheetDropItemFlashState;
		setContext<SheetDropItemFlashState>('sheetState', sheetStateRef);
	}

	const toggleWounds = playerCharacterSheetState.toggleWounds;
	const updateCurrentHP = playerCharacterSheetState.updateCurrentHP;
	const updateMaxHP = playerCharacterSheetState.updateMaxHP;
	const updateTempHP = playerCharacterSheetState.updateTempHP;
	const updateCurrentMana = playerCharacterSheetState.updateCurrentMana;
	const updateMaxMana = playerCharacterSheetState.updateMaxMana;
	const updateCurrentHitDice = playerCharacterSheetState.updateCurrentHitDice;
	const rollHitDice = playerCharacterSheetState.rollHitDice;
	const editCurrentHitDice = playerCharacterSheetState.editCurrentHitDice;
	const toggleEditingEnabled = playerCharacterSheetState.toggleEditingEnabled;
</script>

<header class="nimble-sheet__header">
	<div class="nimble-icon nimble-icon--actor">
		<ul
			class="nimble-wounds-list"
			class:nimble-wounds-list--centered={wounds.max > 9 && wounds.max % 6 >= 3}
		>
			{#each { length: wounds.max }, i}
				<li class="nimble-wounds-list__item">
					<button
						class="nimble-wounds-list__button"
						class:nimble-wounds-list__button--active={wounds.value > i}
						type="button"
						data-tooltip="Toggle Wound"
						data-tooltip-direction="LEFT"
						aria-label="Toggle wound"
						onclick={() => toggleWounds(i + 1)}
					>
						<i class="nimble-wounds-list__icon fa-solid fa-droplet"></i>
					</button>
				</li>
			{/each}
		</ul>

		<button
			class="nimble-icon__button nimble-icon__button--actor"
			aria-label={editingEnabled ? localize('NIMBLE.prompts.changeActorImage') : ''}
			data-tooltip={editingEnabled ? 'NIMBLE.prompts.changeActorImage' : null}
			onclick={(event) => updateDocumentImage(actor, { shiftKey: event.shiftKey })}
			type="button"
			disabled={!editingEnabled}
		>
			<img
				class="nimble-icon__image nimble-icon__image--actor"
				src={actor.reactive.img}
				alt={actor.reactive.name}
				style="
					--nimble-actor-image-x-offset: {actorImageXOffset}px;
					--nimble-actor-image-y-offset: {actorImageYOffset}px;
					--nimble-actor-image-scale: {actorImageScale}%;
				"
			/>
		</button>
	</div>

	<section class="nimble-character-sheet-section nimble-character-sheet-section--defense">
		<h3 class="nimble-heading nimble-heading--hp">
			Hit Points

			<span data-tooltip={isBloodied ? 'Bloodied' : null}>
				{#if isBloodied}
					<i class="fa-solid fa-heart-crack"></i>
				{:else}
					<i class="fa-solid fa-heart"></i>
				{/if}
			</span>

			{#if wounds.value > 0}
				<span
					class="nimble-wounds-indicator"
					data-tooltip="{wounds.value} {wounds.value === 1 ? 'Wound' : 'Wounds'}"
				>
					<i class="nimble-wounds-list__icon fa-solid fa-droplet"></i>
					<span class="nimble-wounds-indicator__count">{wounds.value}</span>
				</span>
			{/if}
			<button
				class="nimble-button"
				class:nimble-button--hidden={!editingEnabled}
				data-button-variant="icon"
				type="button"
				aria-label="Configure Hit Points"
				data-tooltip="Configure Hit Points"
				onclick={() => actor.configureHitPoints()}
			>
				<i class="fa-solid fa-edit"></i>
			</button>
		</h3>

		<HitPointBar
			currentHP={actor.reactive.system.attributes.hp.value}
			maxHP={actor.reactive.system.attributes.hp.max}
			tempHP={actor.reactive.system.attributes.hp.temp}
			{isBloodied}
			{updateCurrentHP}
			{updateMaxHP}
			{updateTempHP}
			disableMaxHPEdit={!editingEnabled}
		/>

		<h3 class="nimble-heading nimble-heading--hit-dice">
			{CONFIG.NIMBLE.hitDice.heading}
			<i class="fa-solid fa-heart-circle-plus"></i>
			<button
				class="nimble-button"
				class:nimble-button--hidden={!editingEnabled}
				data-button-variant="icon"
				type="button"
				aria-label={CONFIG.NIMBLE.hitDice.configureHitDice}
				data-tooltip={CONFIG.NIMBLE.hitDice.configureHitDice}
				onclick={() => actor.configureHitDice()}
			>
				<i class="fa-solid fa-edit"></i>
			</button>
		</h3>

		<HitDiceBar
			value={hitDiceData.value}
			max={hitDiceData.max}
			bySize={hitDiceData.bySize}
			{updateCurrentHitDice}
			{editCurrentHitDice}
			{rollHitDice}
			disableControls={!editingEnabled}
		/>

		{#if hasMana}
			<h3 class="nimble-heading nimble-heading--mana">
				Mana
				<i class="fa-solid fa-sparkles"></i>
				<button
					class="nimble-button"
					class:nimble-button--hidden={!editingEnabled}
					data-button-variant="icon"
					type="button"
					aria-label={CONFIG.NIMBLE.manaConfig.configureMana}
					data-tooltip={CONFIG.NIMBLE.manaConfig.configureMana}
					onclick={() => actor.configureMana()}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			</h3>

			<ManaBar
				currentMana={mana.current}
				maxMana={mana.max || mana.baseMax}
				{updateCurrentMana}
				{updateMaxMana}
				disableMaxManaEdit={true}
			/>
		{/if}
	</section>

	<div class="nimble-player-character-header">
		<input
			class="nimble-heading"
			data-heading-variant="document"
			type="text"
			value={actor.reactive.name}
			autocomplete="off"
			spellcheck="false"
			onchange={({ target }) => actor.update({ name: target.value })}
			disabled={!editingEnabled}
		/>

		{#if metaData}
			<h4 class="nimble-character-meta">
				{metaData}

				{#if editingEnabled}
					<button
						class="nimble-button"
						type="button"
						data-button-variant="icon"
						aria-label="Edit"
						data-tooltip="Edit"
						onclick={() => actor.editMetadata()}
					>
						<i class="fa-solid fa-edit"></i>
					</button>
				{/if}
			</h4>
		{/if}
	</div>
</header>

<PrimaryNavigation bind:currentTab {navigation} condenseNavigation={true} />

<currentTab.component />

<section class="nimble-sheet__sidebar">
	<button
		class="nimble-button"
		data-button-variant="overhang"
		class:nimble-edit-toggle--enabled={editingEnabled}
		class:nimble-edit-toggle--disabled={!editingEnabled}
		type="button"
		aria-pressed={editingEnabled}
		aria-label={editingEnabled ? 'Disable editing' : 'Enable editing'}
		data-tooltip={editingEnabled ? 'Editing Enabled' : 'Editing Locked'}
		onclick={toggleEditingEnabled}
	>
		<span class="nimble-edit-toggle__track">
			<span class="nimble-edit-toggle__thumb">
				<i class="fa-solid {editingEnabled ? 'fa-pen' : 'fa-lock'}"></i>
			</span>
		</span>
	</button>
	{#if editingEnabled}
		<button
			class="nimble-button"
			data-button-variant="overhang"
			aria-label={localize('NIMBLE.prompts.levelUp')}
			data-tooltip={localize('NIMBLE.prompts.levelUp')}
			onclick={() => actor.triggerLevelUp()}
			disabled={!classItem || classItem?.system?.classLevel >= 20}
			type="button"
		>
			<i class="fa-solid fa-arrow-up-right-dots"></i>
		</button>

		<button
			class="nimble-button"
			data-button-variant="overhang"
			aria-label="Revert Last Level Up"
			data-tooltip="Revert Last Level Up"
			onclick={() => actor.triggerLevelDown()}
			disabled={actor.reactive.system.levelUpHistory.length === 0}
			type="button"
		>
			<i class="fa-solid fa-undo"></i>
		</button>
	{/if}

	<button
		class="nimble-button"
		data-button-variant="overhang"
		aria-label={localize('NIMBLE.prompts.fieldRest')}
		data-tooltip={localize('NIMBLE.prompts.fieldRest')}
		onclick={() => actor.triggerRest({ restType: 'field' })}
		type="button"
	>
		<i class="fa-regular fa-hourglass-half"></i>
	</button>

	<button
		class="nimble-button"
		data-button-variant="overhang"
		aria-label={localize('NIMBLE.prompts.safeRest')}
		data-tooltip={localize('NIMBLE.prompts.safeRest')}
		onclick={() => actor.triggerRest({ restType: 'safe' })}
		type="button"
	>
		<i class="fa-solid fa-moon"></i>
	</button>

	<ActionTracker {actor} />
</section>

<style lang="scss">
	.nimble-sheet__header {
		position: relative;
	}

	.nimble-edit-toggle__track {
		position: relative;
		width: 2.1rem;
		height: 1rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--nimble-sheet-background) 30%, transparent);
		border: none;
		box-shadow: var(--nimble-navigation-button-box-shadow);
		display: flex;
		align-items: center;
		transition: background-color 0.2s ease-in-out;
	}

	.nimble-edit-toggle--disabled .nimble-edit-toggle__track {
		background: hsl(0, 0%, 20%);
		box-shadow:
			0 0 0 1px hsl(0, 0%, 35%),
			0 0 0 2px hsl(0, 0%, 12%),
			0 3px 5px rgba(0, 0, 0, 0.4);
	}

	.nimble-edit-toggle__thumb {
		position: absolute;
		left: 0;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: #842c2b;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: hsl(0, 0%, 95%);
		font-size: 0.5rem;
		transform: translateX(0);
		transition:
			transform 0.2s ease-in-out,
			background-color 0.2s ease-in-out;
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.45);
	}

	.nimble-edit-toggle--disabled .nimble-edit-toggle__thumb {
		transform: translateX(1.1rem);
		background: hsl(0, 0%, 65%);
		color: hsl(0, 0%, 20%);
	}

	.nimble-player-character-header {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex-grow: 1;
		gap: 0.125rem;
		padding: 0.75rem 0.5rem 0.375rem 0.5rem;
	}

	.nimble-character-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		font-synthesis: none;
		border: 0;
		color: var(--nimble-medium-text-color);
		text-shadow: none;

		&:hover {
			--nimble-edit-button-opacity: 1;
		}
	}

	.nimble-character-meta {
		--nimble-button-font-size: var(--nimble-sm-text);
		--nimble-button-opacity: 0;
		--nimble-button-padding: 0;
		--nimble-button-icon-y-nudge: -1px;

		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		font-synthesis: none;
		border: 0;
		color: var(--nimble-medium-text-color);
		text-shadow: none;

		&:hover {
			--nimble-button-opacity: 1;
		}
	}

	.nimble-character-sheet-section {
		padding: 0.5rem;

		&:not(:last-of-type) {
			border-bottom: 1px solid hsl(41, 18%, 54%);
		}

		&--defense,
		&--defense:not(:last-of-type) {
			border: none;
			padding: 0;
		}

		&--defense {
			position: relative;
			display: grid;
			// Keep the hit dice column compact so HP stays the primary bar.
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'hpHeading hitDiceHeading'
				'hpBar hitDiceBar'
				'manaHeading manaHeading'
				'manaBar manaBar';
			grid-gap: 0 0.125rem;
			margin-block-start: 0.25rem;
			margin-inline: 0.25rem;
		}
	}

	.nimble-wounds-indicator {
		// Always use dark mode text color for icon stroke (light cream color)
		--stroke-color: hsl(36, 53%, 80%);

		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		margin-inline-start: 0.25rem;
		cursor: default;

		&__count {
			font-weight: 700;
			font-size: var(--nimble-sm-text);
			line-height: 1;
			// Use same color as heading for consistency
			color: var(--nimble-dark-text-color);
		}

		i {
			font-size: inherit;
			color: #b01b19;
			// Firefox fallback: text-shadow simulates stroke
			text-shadow:
				-0.5px -0.5px 0 var(--stroke-color),
				0.5px -0.5px 0 var(--stroke-color),
				-0.5px 0.5px 0 var(--stroke-color),
				0.5px 0.5px 0 var(--stroke-color);
			-webkit-text-stroke: 0.5px var(--stroke-color);
		}
	}

	.nimble-heading--hp {
		--nimble-button-icon-y-nudge: 0;

		grid-area: hpHeading;
		// Prevent wounds label from expanding the heading beyond available space
		overflow: hidden;
		min-width: 0;

		.nimble-button {
			opacity: 0;
			transition: opacity 0.2s ease-in-out;
		}

		&:hover .nimble-button {
			opacity: 1;
		}
	}

	.nimble-heading--hit-dice {
		--nimble-button-icon-y-nudge: 0;

		grid-area: hitDiceHeading;

		.nimble-button {
			opacity: 0;
			transition: opacity 0.2s ease-in-out;
		}

		&:hover .nimble-button {
			opacity: 1;
		}
	}

	.nimble-heading--mana {
		--nimble-button-icon-y-nudge: 0;

		grid-area: manaHeading;
		margin-block-start: 0.25rem;
	}
</style>
