<script lang="ts">
	import type { OpportunityReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createOpportunityPanelState } from './OpportunityReactionPanel.svelte.ts';
	import WeaponCard from './WeaponCard.svelte';

	const sheet = getContext('application');

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
		showEmbeddedDocumentImages = true,
	}: OpportunityReactionPanelProps = $props();

	const {
		meleeWeapons,
		showUnarmedStrike,
		availableTargets,
		selectedTarget,
		isDisabled,
		sortItems,
		getWeaponDamage,
		getWeaponProperties,
		getTargetName,
		getUnarmedDamageDisplay,
		handleUnarmedStrike,
		handleItemClick,
	} = createOpportunityPanelState(
		() => actor,
		() => onDeductAction,
		() => inCombat,
		() => actionsRemaining,
	);
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

	<div class="reaction-panel__target-section">
		<span class="reaction-panel__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.target')}
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-panel__no-target">
				<span>{localize('NIMBLE.ui.heroicActions.reactions.targetEnemy')}</span>
			</div>
		{:else if availableTargets.length === 1}
			<div class="reaction-panel__target">
				<img
					class="reaction-panel__target-img"
					src={selectedTarget?.document?.texture?.src || 'icons/svg/mystery-man.svg'}
					alt={getTargetName(selectedTarget)}
				/>
				<span class="reaction-panel__target-name">{getTargetName(selectedTarget)}</span>
				<i class="fa-solid fa-check reaction-panel__target-check"></i>
			</div>
		{:else}
			<div class="reaction-panel__no-target reaction-panel__no-target--warning">
				<i class="fa-solid fa-triangle-exclamation"></i>
				<span>{localize('NIMBLE.ui.heroicActions.reactions.multipleTargets')}</span>
			</div>
		{/if}
	</div>

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
		background: linear-gradient(135deg, hsl(15, 70%, 50%) 0%, hsl(15, 70%, 40%) 100%);
	}

	.reaction-panel__badge {
		color: hsl(25, 75%, 25%);
		background: hsl(35, 80%, 90%);
	}

	.reaction-panel__target {
		background: hsl(15, 70%, 95%);
		border-color: hsl(15, 60%, 70%);
	}

	.reaction-panel__target-img {
		border-color: hsl(15, 50%, 60%);
	}

	:global(.theme-dark) .reaction-panel__badge {
		color: hsl(40, 90%, 75%);
		background: hsl(30, 60%, 22%);
	}

	:global(.theme-dark) .reaction-panel__target {
		background: hsl(15, 50%, 22%);
		border-color: hsl(15, 60%, 45%);
	}
</style>
