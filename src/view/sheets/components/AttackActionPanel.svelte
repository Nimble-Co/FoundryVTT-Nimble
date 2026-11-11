<script lang="ts">
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { activeOrigins } from '#utils/actor/activeOrigins.js';
	import { createAttackPanelState } from './AttackActionPanel.svelte.ts';
	import { getPools, getPoolsForItem } from '#utils/chargePool/chargePoolSync.js';

	import SearchBar from './SearchBar.svelte';
	import WeaponCard from './WeaponCard.svelte';

	const actor = getContext<NimbleCharacter>('actor');
	const sheet = getContext('application');

	let { onActivateItem = async () => {}, showEmbeddedDocumentImages = true } = $props();

	const state = createAttackPanelState(
		() => actor,
		() => onActivateItem,
	);

	// The items whose use gave the actor an effect that is on: their rows show "Active".
	let activeItems = $derived.by(() => {
		void state.effectVersion;
		return activeOrigins(actor.effects);
	});

	// Effects on the actor are not on actor.reactive, so the AE hooks redraw the Active tags.
	// $effect handles mount/unmount lifecycle and cleanup, avoiding the eager-registration
	// runtime error we hit when calling Hooks.on outside a component lifecycle scope.
	$effect(() => {
		const actorId = (actor as { id?: string } | null)?.id;
		if (!actorId) return;
		const bump = (effect: { parent?: { documentName?: string; id?: string } }) => {
			if (effect?.parent?.documentName !== 'Actor') return;
			if (effect.parent.id !== actorId) return;
			state.bumpEffectVersion();
		};
		const createHook = (
			Hooks as unknown as {
				on: (name: string, fn: (...args: unknown[]) => void) => number;
			}
		).on('createActiveEffect', bump as (...args: unknown[]) => void);
		const updateHook = (
			Hooks as unknown as {
				on: (name: string, fn: (...args: unknown[]) => void) => number;
			}
		).on('updateActiveEffect', bump as (...args: unknown[]) => void);
		const deleteHook = (
			Hooks as unknown as {
				on: (name: string, fn: (...args: unknown[]) => void) => number;
			}
		).on('deleteActiveEffect', bump as (...args: unknown[]) => void);
		return () => {
			Hooks.off('createActiveEffect', createHook);
			Hooks.off('updateActiveEffect', updateHook);
			Hooks.off('deleteActiveEffect', deleteHook);
		};
	});

	function handleUnarmedStrikeDragStart(event: DragEvent) {
		if (!event.dataTransfer) return;
		const dragData = {
			type: 'HeroicAction',
			actionId: 'unarmedStrike',
			actionType: 'action',
			name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
		};
		event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
	}

	// Every charge pool on the actor, resolved once. Each row is handed its own
	// slice, so a long list does not rebuild the whole map per row.
	let allPools = $derived(getPools(actor.reactive));
</script>

<section class="attack-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.selectAttack')}
		</h3>
	</header>

	<div class="attack-panel__search">
		<SearchBar bind:searchTerm={state.searchTerm} />
	</div>

	<div class="attack-panel__content">
		<ul class="attack-panel__list">
			{#if state.showUnarmedStrike}
				<WeaponCard
					name={localize('NIMBLE.ui.heroicActions.unarmedStrike')}
					icon="fa-solid fa-hand-fist"
					damage={state.getUnarmedDamageDisplay()}
					properties={[localize('NIMBLE.npcSheet.melee')]}
					showImage={false}
					onclick={state.handleUnarmedStrike}
					ondragstart={handleUnarmedStrikeDragStart}
				/>
			{/if}

			{#each state.sortItems(state.weapons) as item (item._id)}
				<WeaponCard
					name={item.reactive.name}
					{actor}
					image={item.reactive.img}
					damage={state.getWeaponDamage(item)}
					properties={state.getWeaponProperties(item)}
					description={state.getItemDescription(item)}
					isExpanded={state.expandedDescriptions.has(item._id)}
					showImage={showEmbeddedDocumentImages}
					itemId={item._id}
					pools={getPoolsForItem(actor.reactive, item._id, allPools)}
					onclick={() => state.handleItemClick(item._id)}
					ondragstart={(event) => sheet._onDragStart(event)}
					onToggleDescription={(e) => state.toggleDescription(item._id, e)}
				/>
			{/each}

			{#each state.sortItems(state.attackFeatures) as item (item._id)}
				<WeaponCard
					name={item.reactive.name}
					{actor}
					image={item.reactive.img}
					damage={state.getWeaponDamage(item)}
					properties={[localize('NIMBLE.ui.heroicActions.feature')]}
					description={state.getItemDescription(item)}
					isExpanded={state.expandedDescriptions.has(item._id)}
					showImage={showEmbeddedDocumentImages}
					itemId={item._id}
					pools={getPoolsForItem(actor.reactive, item._id, allPools)}
					active={activeItems.has(item.uuid)}
					onclick={() => state.handleItemClick(item._id)}
					ondragstart={(event) => sheet._onDragStart(event)}
					onToggleDescription={(e) => state.toggleDescription(item._id, e)}
				/>
			{/each}
		</ul>

		{#if !state.showUnarmedStrike && state.weapons.length === 0 && state.attackFeatures.length === 0}
			<p class="attack-panel__empty">{localize('NIMBLE.ui.heroicActions.noWeapons')}</p>
		{/if}
	</div>
</section>

<style lang="scss">
	.attack-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__search {
			display: flex;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			overflow-y: auto;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__empty {
			margin: 0;
			padding: 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}
	}
</style>
