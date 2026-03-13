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

	async function handleHelp() {
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
				reactionType: 'help',
				targets: targetUuids,
			},
		};
		await ChatMessage.create(chatData);
	}
</script>

<section class="reaction-card">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-handshake-angle"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.help.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-card__badge">
			<i class="fa-solid fa-dice-d20"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.advantage')}
		</div>
	</div>

	<p class="reaction-card__description">
		{@html localize('NIMBLE.ui.heroicActions.reactions.help.panelDescription')}
	</p>

	<div class="reaction-card__target-section">
		<span class="reaction-card__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.help.helping')}
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-card__no-target">
				<span>{localize('NIMBLE.ui.heroicActions.reactions.targetAllyOptional')}</span>
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
		{localize('NIMBLE.ui.heroicActions.reactions.help.tip')}
	</p>

	<button
		class="reaction-card__button"
		disabled={!inCombat || actionsRemaining <= 0}
		onclick={handleHelp}
	>
		<i class="fa-solid fa-handshake-angle"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.help.confirm')}
	</button>
</section>

<style lang="scss">
	// Help-specific colors
	.reaction-card__icon {
		background: linear-gradient(135deg, hsl(145, 55%, 45%) 0%, hsl(145, 55%, 35%) 100%);
	}

	.reaction-card__badge {
		color: hsl(145, 60%, 25%);
		background: hsl(145, 55%, 90%);
	}

	.reaction-card__description :global(strong) {
		color: hsl(145, 55%, 35%);
	}

	.reaction-card__target {
		background: hsl(145, 50%, 95%);
		border-color: hsl(145, 50%, 70%);
	}

	.reaction-card__target-img {
		border-color: hsl(145, 40%, 60%);
	}

	.reaction-card__button {
		background: linear-gradient(135deg, hsl(145, 55%, 45%) 0%, hsl(145, 55%, 35%) 100%);

		&:hover:not(:disabled) {
			background: linear-gradient(135deg, hsl(145, 55%, 50%) 0%, hsl(145, 55%, 40%) 100%);
		}
	}

	:global(.theme-dark) .reaction-card__badge {
		color: hsl(145, 70%, 70%);
		background: hsl(145, 45%, 22%);
	}

	:global(.theme-dark) .reaction-card__description :global(strong) {
		color: hsl(145, 55%, 60%);
	}

	:global(.theme-dark) .reaction-card__target {
		background: hsl(145, 40%, 22%);
		border-color: hsl(145, 50%, 45%);
	}
</style>
