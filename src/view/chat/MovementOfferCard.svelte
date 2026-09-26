<script lang="ts">
	import type { MovementOfferCardProps } from '../../../types/components/MovementOfferCard.d.ts';
	import type { MoveNode as MoveNodeData } from '#types/effectTree.js';

	import { setContext, untrack } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import MoveNode from './components/MoveNode.svelte';

	interface OfferSystem {
		name: string;
		image?: string;
		reason: string;
		activation?: { effects?: MoveNodeData[] };
	}

	const { messageDocument }: MovementOfferCardProps = $props();

	const system = $derived(messageDocument.reactive.system as unknown as OfferSystem);
	const moveNodes = $derived(
		(system.activation?.effects ?? []).filter((node) => node.type === 'move'),
	);
	const headerBackgroundColor = $derived(messageDocument.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-movement-offer-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="movementOffer"
>
	<CardBodyHeader
		image={system.image || 'icons/svg/item-bag.svg'}
		alt={system.name}
		heading={system.name}
		subheading={system.reason || undefined}
	/>

	<section class="nimble-movement-offer-card__section">
		{#each moveNodes as node (node.id)}
			<MoveNode {node} />
		{/each}
	</section>
</article>

<style lang="scss">
	.nimble-movement-offer-card {
		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: var(--nimble-card-section-padding, 0.5rem);
		}
	}
</style>
