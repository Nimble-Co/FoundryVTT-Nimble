<script lang="ts">
	import type { NimbleChatMessage } from '../../documents/chatMessage.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import localize from '../../utils/localize.js';

	import CardHeader from './components/CardHeader.svelte';

	interface Props {
		messageDocument: NimbleChatMessage;
	}

	const { messageDocument }: Props = $props();

	const system = $derived(messageDocument.reactive.system);
	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const actorName = $derived(system.actorName);
	const speed = $derived(system.speed);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body move-action-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="moveAction"
>
	<header class="move-action-card__header">
		<div class="move-action-card__icon">
			<i class="fa-solid fa-person-running"></i>
		</div>
		<div class="move-action-card__title-group">
			<h3 class="move-action-card__title">{localize('NIMBLE.ui.heroicActions.move.title')}</h3>
			<span class="move-action-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="move-action-card__badge">
			<i class="fa-solid fa-shoe-prints"></i>
			{localize('NIMBLE.ui.heroicActions.move.speedBadge', { speed })}
		</div>
	</header>

	<div class="move-action-card__message">
		{@html localize('NIMBLE.ui.heroicActions.move.chatMessage', { name: actorName, speed })}
	</div>
</article>

<style lang="scss">
	.move-action-card {
		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: var(--nimble-card-section-padding, 0.5rem);
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.875rem;
			height: 1.875rem;
			background: linear-gradient(135deg, hsl(185, 60%, 45%) 0%, hsl(185, 60%, 35%) 100%);
			border-radius: 6px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
				color: white;
			}
		}

		&__title-group {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
		}

		&__title {
			margin: 0;
			font-size: var(--nimble-base-text);
			font-weight: 700;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__cost {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);

			i {
				font-size: 0.625rem;
			}
		}

		&__badge {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.625rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			border-radius: 6px;
			color: hsl(185, 70%, 25%);
			background: hsl(185, 50%, 90%);

			i {
				font-size: 0.75rem;
			}
		}

		&__message {
			padding: var(--nimble-card-section-padding, 0.5rem);
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
			line-height: 1.5;

			:global(p) {
				margin: 0;
			}
		}
	}

	:global(.theme-dark) .move-action-card__badge {
		color: hsl(185, 80%, 75%);
		background: hsl(185, 40%, 25%);
	}
</style>
