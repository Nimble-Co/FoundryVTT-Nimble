<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

	let armorValue = $derived(actor.reactive.system.attributes.armor.value ?? 0);

	async function handleDefend() {
		if (!inCombat || actionsRemaining <= 0) return;

		await onDeductAction();

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
				reactionType: 'defend',
				armorValue,
				targets: [],
			},
		};
		await ChatMessage.create(chatData);
	}
</script>

<section class="reaction-card">
	<div class="reaction-card__header">
		<div class="reaction-card__icon">
			<i class="fa-solid fa-shield"></i>
		</div>
		<div class="reaction-card__title-group">
			<h3 class="reaction-card__title">
				{localize('NIMBLE.ui.heroicActions.reactions.defend.title')}
			</h3>
			<span class="reaction-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-card__badge">
			<i class="fa-solid fa-shield"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.defend.armorBadge', { armor: armorValue })}
		</div>
	</div>

	<p class="reaction-card__description">
		{@html localize('NIMBLE.ui.heroicActions.reactions.defend.panelDescription', {
			armor: armorValue,
		})}
	</p>

	<button
		class="reaction-card__button"
		disabled={!inCombat || actionsRemaining <= 0}
		onclick={handleDefend}
	>
		<i class="fa-solid fa-shield"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.defend.confirm')}
	</button>
</section>

<style lang="scss">
	// Defend-specific colors
	.reaction-card__icon {
		background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 60%, 40%) 100%);
	}

	.reaction-card__badge {
		color: hsl(210, 70%, 30%);
		background: hsl(210, 60%, 92%);
	}

	.reaction-card__description :global(strong) {
		color: hsl(210, 60%, 45%);
	}

	.reaction-card__button {
		background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 60%, 40%) 100%);

		&:hover:not(:disabled) {
			background: linear-gradient(135deg, hsl(210, 60%, 55%) 0%, hsl(210, 60%, 45%) 100%);
		}
	}

	:global(.theme-dark) .reaction-card__badge {
		color: hsl(210, 80%, 75%);
		background: hsl(210, 50%, 25%);
	}

	:global(.theme-dark) .reaction-card__description :global(strong) {
		color: hsl(210, 70%, 65%);
	}
</style>
