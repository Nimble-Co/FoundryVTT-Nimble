<script lang="ts">
	import type { MovementTriggerCardProps } from '#types/components/MovementTriggerCard.d.ts';

	import localize from '#utils/localize.js';
	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import { createMovementTriggerCardState } from './MovementTriggerCardState.svelte.ts';

	const { messageDocument }: MovementTriggerCardProps = $props();

	const card = createMovementTriggerCardState(() => messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-movement-trigger-card"
	style="--nimble-user-background-color: {card.headerBackgroundColor}; --nimble-user-text-color: {card.headerTextColor};"
	data-card-type="movementTrigger"
>
	<CardBodyHeader
		image={card.system.image || 'icons/svg/item-bag.svg'}
		alt={card.system.name}
		heading={card.system.name}
	/>

	<section class="nimble-movement-trigger-card__section">
		<p class="nimble-movement-trigger-card__message">{card.system.message}</p>

		{#if card.targetNames}
			<p class="nimble-movement-trigger-card__targets">
				{localize('NIMBLE.chat.movementTrigger.targets', { names: card.targetNames })}
			</p>
		{/if}

		{#if card.canUse}
			<button class="nimble-button" type="button" disabled={card.using} onclick={card.useItem}>
				<i class="nimble-button__icon fa-solid fa-dice-d20" aria-hidden="true"></i>
				{localize('NIMBLE.chat.movementTrigger.use', { name: card.system.name })}
			</button>
		{/if}
	</section>
</article>

<style lang="scss">
	.nimble-movement-trigger-card {
		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			padding: var(--nimble-card-section-padding, 0.5rem);
		}

		&__message,
		&__targets {
			margin: 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__targets {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
