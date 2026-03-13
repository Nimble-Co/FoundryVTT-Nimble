<script lang="ts">
	import { getContext } from 'svelte';
	import type { OpportunityReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';
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

	const panelState = createOpportunityPanelState(
		() => actor,
		() => onDeductAction,
	);

	let targetingVersion = $state(0);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(actor.id ?? '');
	});

	const selectedTarget = $derived(availableTargets.length === 1 ? availableTargets[0] : null);

	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	let isDisabled = $derived(!inCombat || actionsRemaining <= 0);
</script>

<section class="reaction-card">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-bullseye"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.opportunity.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-card__badge">
			<i class="fa-solid fa-dice"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.disadvantage')}
		</div>
	</div>

	<p class="reaction-card__description">
		{localize('NIMBLE.ui.heroicActions.reactions.opportunity.panelDescription')}
	</p>

	<div class="reaction-card__target-section">
		<span class="reaction-card__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.target')}
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-card__no-target">
				<span>{localize('NIMBLE.ui.heroicActions.reactions.targetEnemy')}</span>
			</div>
		{:else if availableTargets.length === 1}
			<div class="reaction-card__target">
				<img
					class="reaction-card__target-img"
					src={selectedTarget?.document?.texture?.src || 'icons/svg/mystery-man.svg'}
					alt={getTargetName(selectedTarget)}
				/>
				<span class="reaction-card__target-name">{getTargetName(selectedTarget)}</span>
				<i class="fa-solid fa-check reaction-card__target-check"></i>
			</div>
		{:else}
			<div class="reaction-card__no-target reaction-card__no-target--warning">
				<i class="fa-solid fa-triangle-exclamation"></i>
				<span>{localize('NIMBLE.ui.heroicActions.reactions.multipleTargets')}</span>
			</div>
		{/if}
	</div>

	<ul class="reaction-card__weapons">
		{#if panelState.showUnarmedStrike}
			<WeaponCard
				name={localize('NIMBLE.ui.heroicActions.unarmedStrike')}
				icon="fa-solid fa-hand-fist"
				damage={panelState.getUnarmedDamageDisplay()}
				properties={[localize('NIMBLE.npcSheet.melee')]}
				disabled={isDisabled}
				showImage={false}
				onclick={() => panelState.handleUnarmedStrike()}
			/>
		{/if}

		{#each panelState.sortItems(panelState.meleeWeapons) as item (item._id)}
			<WeaponCard
				name={item.reactive.name}
				image={item.reactive.img}
				damage={panelState.getWeaponDamage(item)}
				properties={panelState.getWeaponProperties(item)}
				disabled={isDisabled}
				showImage={showEmbeddedDocumentImages}
				itemId={item._id}
				onclick={() => panelState.handleItemClick(item._id)}
				ondragstart={(event) => sheet._onDragStart(event)}
			/>
		{/each}

		{#if !panelState.showUnarmedStrike && panelState.meleeWeapons.length === 0}
			<p class="reaction-card__empty">
				{localize('NIMBLE.ui.heroicActions.reactions.opportunity.noMeleeWeapons')}
			</p>
		{/if}
	</ul>
</section>

<style lang="scss">
	// Opportunity-specific colors
	.reaction-card__icon {
		background: linear-gradient(135deg, hsl(15, 70%, 50%) 0%, hsl(15, 70%, 40%) 100%);
	}

	.reaction-card__badge {
		color: hsl(25, 75%, 25%);
		background: hsl(35, 80%, 90%);
	}

	.reaction-card__target {
		background: hsl(15, 70%, 95%);
		border-color: hsl(15, 60%, 70%);
	}

	.reaction-card__target-img {
		border-color: hsl(15, 50%, 60%);
	}

	:global(.theme-dark) .reaction-card__badge {
		color: hsl(40, 90%, 75%);
		background: hsl(30, 60%, 22%);
	}

	:global(.theme-dark) .reaction-card__target {
		background: hsl(15, 50%, 22%);
		border-color: hsl(15, 60%, 45%);
	}
</style>
