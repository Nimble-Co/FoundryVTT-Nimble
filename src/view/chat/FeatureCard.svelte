<script>
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import ItemCardEffects from './components/ItemCardEffects.svelte';
	import Targets from './components/Targets.svelte';

	function getCardSubheading(activation, isCritical, isMiss) {
		if (!activation) return null;
		if (!activation.effects?.length) return null;
		if (!activation.effects.some((node) => node.type === 'damage')) return null;

		if (isCritical) return 'Critical Hit';
		if (isMiss) return 'Miss';
		return 'Hit';
	}

	function getAttackTypeLabel(attackType, distance) {
		if (!attackType) return null;

		if (attackType === 'melee') return game.i18n.localize('NIMBLE.npcSheet.melee');
		const key = attackType === 'reach' ? 'NIMBLE.npcSheet.reach' : 'NIMBLE.npcSheet.range';
		return game.i18n.format(key, { distance });
	}

	const { messageDocument } = $props();

	let {
		activation,
		name,
		description,
		featureType,
		image,
		isCritical,
		isMiss,
		attackType,
		attackDistance,
	} = $derived(messageDocument.reactive.system);

	let subheading = $derived(getCardSubheading(activation, isCritical, isMiss));
	let attackTypeLabel = $derived(getAttackTypeLabel(attackType, attackDistance));

	const headerBackgroundColor = messageDocument.reactive.author.color;
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	setContext('messageDocument', messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader
		image={image || 'icons/svg/item-bag.svg'}
		alt={name}
		heading={name}
		{subheading}
	/>

	{#if attackTypeLabel}
		<section class="nimble-card-section nimble-card-section--attack-type">
			<span class="nimble-attack-type-tag">{attackTypeLabel}</span>
		</section>
	{/if}

	{#if featureType === 'feature' || featureType === 'monsterFeature'}
		<Targets />
	{/if}

	{#if description}
		<section class="nimble-card-section nimble-card-section--description">
			{@html description}
		</section>
	{/if}

	{#if featureType === 'feature' || featureType === 'monsterFeature'}
		<ItemCardEffects />
	{/if}
</article>

<style lang="scss">
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}

		&--attack-type {
			display: flex;
			gap: 0.25rem;
		}
	}

	.nimble-attack-type-tag {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.125rem 0.5rem;
		background: hsl(41, 18%, 54%, 15%);
		border-radius: 3px;
		color: var(--nimble-muted-text-color, hsl(41, 18%, 40%));
	}

	:global(.nimble-card-section--description *:first-child) {
		margin-block-start: 0 !important;
	}

	:global(.nimble-card-section--description *:last-child) {
		margin-block-end: 0 !important;
	}
</style>
