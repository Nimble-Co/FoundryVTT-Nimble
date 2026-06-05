<script lang="ts">
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import {
		findToggleEffectAE,
		findToggleEffectRule,
		toggleEffectAE,
	} from '../../../utils/toggleEffectControl.js';
	import { createAttackPanelState } from './AttackActionPanel.svelte.ts';

	import SearchBar from './SearchBar.svelte';
	import WeaponCard from './WeaponCard.svelte';

	const actor = getContext('actor');
	const sheet = getContext('application');

	let { onActivateItem = async () => {}, showEmbeddedDocumentImages = true } = $props();

	const state = createAttackPanelState(
		() => actor,
		() => onActivateItem,
	);

	// toggleEffect switch — surfaces a Foundry AE toggle on attack-feature rows.
	// state.effectVersion is bumped by Hooks listeners registered in the state
	// file when any AE on this actor is created/updated/deleted, so the
	// switch updates from the in-panel click, the PASSIVE EFFECTS panel, or a
	// turnOff trigger without manual sheet refresh.
	function buildToggleState(item: {
		id: string;
		name: string;
		img?: string;
		uuid?: string;
		rules?: { values: () => Iterable<unknown> } | Map<string, unknown>;
	}) {
		void state.effectVersion;
		const rule = findToggleEffectRule(item);
		if (!rule) return null;
		const existing = findToggleEffectAE(actor, rule.id);
		const enabled = existing !== null && !existing.disabled;
		return {
			enabled,
			ariaLabel: localize(
				enabled ? 'NIMBLE.ui.heroicActions.toggleOff' : 'NIMBLE.ui.heroicActions.toggleOn',
				{ name: item.name },
			),
			onClick: async () => {
				await toggleEffectAE(actor, item, rule);
				// AE hook below will bump effectVersion; this immediate bump
				// covers any timing window where the hook hasn't fired yet.
				state.bumpEffectVersion();
			},
		};
	}

	// Subscribe to AE create/update/delete on this actor so the switch
	// updates from external sources (PASSIVE EFFECTS panel, turnOff triggers,
	// chat-card buttons). $effect handles mount/unmount lifecycle and
	// cleanup, avoiding the eager-registration runtime error we hit when
	// calling Hooks.on outside a component lifecycle scope.
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
					image={item.reactive.img}
					damage={state.getWeaponDamage(item)}
					properties={state.getWeaponProperties(item)}
					description={state.getItemDescription(item)}
					isExpanded={state.expandedDescriptions.has(item._id)}
					showImage={showEmbeddedDocumentImages}
					itemId={item._id}
					onclick={() => state.handleItemClick(item._id)}
					ondragstart={(event) => sheet._onDragStart(event)}
					onToggleDescription={(e) => state.toggleDescription(item._id, e)}
				/>
			{/each}

			{#each state.sortItems(state.attackFeatures) as item (item._id)}
				<WeaponCard
					name={item.reactive.name}
					image={item.reactive.img}
					damage={state.getWeaponDamage(item)}
					properties={[localize('NIMBLE.ui.heroicActions.feature')]}
					description={state.getItemDescription(item)}
					isExpanded={state.expandedDescriptions.has(item._id)}
					showImage={showEmbeddedDocumentImages}
					itemId={item._id}
					toggle={buildToggleState(item)}
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
			max-height: 300px;
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
