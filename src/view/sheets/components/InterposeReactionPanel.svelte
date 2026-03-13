<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

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

	async function handleInterpose() {
		if (!inCombat || actionsRemaining <= 0) return;

		await onDeductAction();

		// Collect target UUIDs for the chat card
		const targetUuids = availableTargets.map((t) => t.document.uuid);

		const chatData = {
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor }),
			type: 'reaction',
			system: {
				actorName: actor.name,
				actorType: actor.type,
				image: actor.img,
				permissions: actor.permission,
				rollMode: 0,
				reactionType: 'interpose',
				targets: targetUuids,
			},
		};
		await ChatMessage.create(chatData);
	}

	let isDisabled = $derived(!inCombat || actionsRemaining <= 0);
</script>

<section class="reaction-card">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-people-arrows"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.interpose.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-card__badge">
			<i class="fa-solid fa-ruler"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interpose.rangeBadge')}
		</div>
	</div>

	<p class="reaction-card__description">
		{@html localize('NIMBLE.ui.heroicActions.reactions.interpose.panelDescription')}
	</p>

	<div class="reaction-card__target-section">
		<span class="reaction-card__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interpose.protecting')}
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-card__no-target">
				<span>{localize('NIMBLE.ui.heroicActions.reactions.targetAlly')}</span>
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
				<span>{localize('NIMBLE.ui.heroicActions.reactions.selectOneTarget')}</span>
			</div>
		{/if}
	</div>

	<p class="reaction-card__tip">
		<i class="fa-solid fa-lightbulb"></i>
		{@html localize('NIMBLE.ui.heroicActions.reactions.interpose.tip')}
	</p>

	<button class="reaction-card__button" disabled={isDisabled} onclick={handleInterpose}>
		<i class="fa-solid fa-people-arrows"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.interpose.confirm')}
	</button>
</section>

<style lang="scss">
	// Interpose-specific colors
	.reaction-card__icon {
		background: linear-gradient(135deg, hsl(270, 50%, 55%) 0%, hsl(270, 50%, 45%) 100%);
	}

	.reaction-card__badge {
		color: hsl(270, 60%, 30%);
		background: hsl(270, 50%, 92%);
	}

	.reaction-card__description :global(strong) {
		color: hsl(270, 50%, 40%);
	}

	.reaction-card__target {
		background: hsl(270, 50%, 95%);
		border-color: hsl(270, 50%, 70%);
	}

	.reaction-card__target-img {
		border-color: hsl(270, 40%, 60%);
	}

	.reaction-card__tip :global(strong) {
		color: hsl(210, 60%, 40%);
	}

	.reaction-card__button {
		background: linear-gradient(135deg, hsl(270, 50%, 55%) 0%, hsl(270, 50%, 45%) 100%);

		&:hover:not(:disabled) {
			background: linear-gradient(135deg, hsl(270, 50%, 60%) 0%, hsl(270, 50%, 50%) 100%);
		}
	}

	:global(.theme-dark) .reaction-card__badge {
		color: hsl(270, 70%, 75%);
		background: hsl(270, 40%, 25%);
	}

	:global(.theme-dark) .reaction-card__description :global(strong) {
		color: hsl(270, 60%, 70%);
	}

	:global(.theme-dark) .reaction-card__tip :global(strong) {
		color: hsl(210, 70%, 65%);
	}

	:global(.theme-dark) .reaction-card__target {
		background: hsl(270, 40%, 22%);
		border-color: hsl(270, 50%, 45%);
	}
</style>
