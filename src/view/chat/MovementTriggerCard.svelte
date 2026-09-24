<script lang="ts">
	import type { MovementTriggerCardProps } from '../../../types/components/MovementTriggerCard.d.ts';

	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import localize from '../../utils/localize.js';
	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';

	interface TriggerSystem {
		name: string;
		image?: string;
		itemUuid: string;
		payload: 'offer' | 'reminder';
		message: string;
		targets: string[];
	}

	interface TriggerItem {
		id: string;
		isOwner: boolean;
		actor?: { activateItem(id: string): Promise<unknown> } | null;
	}

	interface TargetTokenDocument {
		id: string;
		name: string;
		object?: unknown;
	}

	const { messageDocument }: MovementTriggerCardProps = $props();

	const system = $derived(messageDocument.reactive.system as unknown as TriggerSystem);
	const headerBackgroundColor = $derived(messageDocument.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	function resolve<T>(uuid: string): T | null {
		if (!uuid) return null;
		return (fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], {
			strict: false,
		}) ?? null) as T | null;
	}

	const targetTokens = $derived(
		(system.targets ?? [])
			.map((uuid) => resolve<TargetTokenDocument>(uuid))
			.filter((token): token is TargetTokenDocument => token !== null),
	);
	const targetNames = $derived(targetTokens.map((token) => token.name).join(', '));

	const item = $derived(resolve<TriggerItem>(system.itemUuid));
	const canUse = $derived(system.payload === 'offer' && item?.isOwner === true);

	function targetCardTokens(): void {
		const layer = canvas?.tokens;
		if (!layer) return;
		// Only tokens drawn on the viewed scene can be targeted.
		const ids = targetTokens.filter((token) => token.object).map((token) => token.id);
		layer.setTargets(ids, { mode: 'replace' });
	}

	async function useItem(): Promise<void> {
		if (!item?.actor) return;
		targetCardTokens();
		await item.actor.activateItem(item.id);
	}
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-movement-trigger-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="movementTrigger"
>
	<CardBodyHeader
		image={system.image || 'icons/svg/item-bag.svg'}
		alt={system.name}
		heading={system.name}
	/>

	<section class="nimble-movement-trigger-card__section">
		<p class="nimble-movement-trigger-card__message">{system.message}</p>

		{#if targetNames}
			<p class="nimble-movement-trigger-card__targets">
				{localize('NIMBLE.chat.movementTrigger.targets', { names: targetNames })}
			</p>
		{/if}

		{#if canUse}
			<button class="nimble-button" type="button" onclick={useItem}>
				<i class="nimble-button__icon fa-solid fa-dice-d20" aria-hidden="true"></i>
				{localize('NIMBLE.chat.movementTrigger.use', { name: system.name })}
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
