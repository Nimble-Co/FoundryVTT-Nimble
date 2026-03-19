<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
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
