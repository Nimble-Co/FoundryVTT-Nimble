<script lang="ts">
	import type { OpportunityReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createOpportunityPanelState } from './OpportunityReactionPanel.svelte.ts';
	import TargetSelector from './TargetSelector.svelte';
	import WeaponCard from './WeaponCard.svelte';

	const sheet = getContext('application');

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
		showEmbeddedDocumentImages = true,
	}: OpportunityReactionPanelProps = $props();

	const state = createOpportunityPanelState(
		() => actor,
		() => onDeductAction,
		() => inCombat,
		() => actionsRemaining,
	);

	const meleeWeapons = $derived(state.meleeWeapons);
	const showUnarmedStrike = $derived(state.showUnarmedStrike);
	const availableTargets = $derived(state.availableTargets);
	const selectedTarget = $derived(state.selectedTarget);
	const isDisabled = $derived(state.isDisabled);
	const {
		sortItems,
		getWeaponDamage,
		getWeaponProperties,
		getTargetName,
		getUnarmedDamageDisplay,
		handleUnarmedStrike,
		handleItemClick,
	} = state;
</script>

<section class="reaction-panel">
	<div class="reaction-panel__header">
		<div class="reaction-panel__icon">
			<i class="fa-solid fa-bullseye"></i>
		</div>
		<div class="reaction-panel__title-group">
			<h3 class="reaction-panel__title">
				{localize('NIMBLE.ui.heroicActions.reactions.opportunity.title')}
			</h3>
			<span class="reaction-panel__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-panel__badge">
			<i class="fa-solid fa-dice"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.disadvantage')}
		</div>
	</div>

	<p class="reaction-panel__description">
		{localize('NIMBLE.ui.heroicActions.reactions.opportunity.panelDescription')}
	</p>

	<TargetSelector
		label="NIMBLE.ui.heroicActions.reactions.target"
		noTargetMessage="NIMBLE.ui.heroicActions.reactions.targetEnemy"
		multipleTargetsMessage="NIMBLE.ui.heroicActions.reactions.multipleTargets"
		{availableTargets}
		{selectedTarget}
		{getTargetName}
		targetBackground="var(--nimble-reaction-opportunity-light)"
		targetBorderColor="var(--nimble-reaction-opportunity-secondary)"
	/>

	<ul class="reaction-panel__weapons">
		{#if showUnarmedStrike}
			<WeaponCard
				name={localize('NIMBLE.ui.heroicActions.unarmedStrike')}
				icon="fa-solid fa-hand-fist"
				damage={getUnarmedDamageDisplay()}
				properties={[localize('NIMBLE.npcSheet.melee')]}
				disabled={isDisabled}
				showImage={false}
				onclick={() => handleUnarmedStrike()}
			/>
		{/if}

		{#each sortItems(meleeWeapons) as item (item._id)}
			<WeaponCard
				name={item.reactive.name}
				image={item.reactive.img}
				damage={getWeaponDamage(item)}
				properties={getWeaponProperties(item)}
				disabled={isDisabled}
				showImage={showEmbeddedDocumentImages}
				itemId={item._id}
				onclick={() => handleItemClick(item._id)}
				ondragstart={(event) => sheet._onDragStart(event)}
			/>
		{/each}

		{#if !showUnarmedStrike && meleeWeapons.length === 0}
			<p class="reaction-panel__empty">
				{localize('NIMBLE.ui.heroicActions.reactions.opportunity.noMeleeWeapons')}
			</p>
		{/if}
	</ul>
</section>

<style lang="scss">
	// Opportunity-specific colors
	.reaction-panel__icon {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-opportunity-primary) 0%,
			var(--nimble-reaction-opportunity-secondary) 100%
		);
	}

	.reaction-panel__badge {
		color: var(--nimble-reaction-opportunity-text);
		background: var(--nimble-reaction-opportunity-accent);
	}
</style>
