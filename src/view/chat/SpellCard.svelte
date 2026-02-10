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

		const hasDamage = activation.effects.some((node) => node.type === 'damage');
		const hasHealing = activation.effects.some((node) => node.type === 'healing');

		if (!hasDamage && !hasHealing) return null;

		if (hasDamage) {
			if (isCritical) return 'Critical Hit';
			if (isMiss) return 'Miss';
			return 'Hit';
		}

		return 'Healing';
	}

	function getUpcastingDescriptionLabel(tier, higherLevelEffectDescription) {
		if (!higherLevelEffectDescription) return null;
		if (tier === 0) return 'At Higher Levels';
		return 'Upcasting';
	}

	let { messageDocument } = $props();

	let { activation, description, image, isCritical, isMiss, spellName, tier, upcast } = $derived(
		messageDocument.reactive.system,
	);

	let headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	let headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
	let subheading = $derived(getCardSubheading(activation, isCritical, isMiss));

	let upcastingLabel = $derived(getUpcastingDescriptionLabel(tier, description.higherLevelEffect));

	let hasUpcast = $derived(upcast?.isUpcast);
	let upcastSummary = $derived(() => {
		if (!hasUpcast) return null;
		const parts = [`Upcast to level ${upcast.manaSpent}`];
		if (upcast.choiceLabel) {
			parts.push(upcast.choiceLabel);
		}
		return parts.join(' — ');
	});

	setContext('messageDocument', messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader
		alt={spellName}
		heading={spellName}
		image={image || 'icons/svg/item-bag.svg'}
		{subheading}
	/>

	<Targets />

	{#if description.baseEffect || description.higherLevelEffect}
		<section class="nimble-card-section nimble-card-section--description">
			{#if description.baseEffect}
				{@html description.baseEffect}
			{:else}
				No description available.
			{/if}

			{#if description.higherLevelEffect}
				<h4 class="nimble-heading" data-heading-variant="section">
					{upcastingLabel}
				</h4>

				{@html description.higherLevelEffect}
			{/if}
		</section>
	{/if}

	<ItemCardEffects />

	{#if hasUpcast}
		<section class="nimble-card-section nimble-upcast-indicator">
			<i class="fa-solid fa-arrow-up-right-dots"></i>
			{upcastSummary()}
		</section>
	{/if}
</article>

<style>
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-upcast-indicator {
		background: var(--nimble-color-primary-alpha);
		color: var(--nimble-color-primary);
		font-weight: 600;
		text-align: center;
		padding: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	:global(.nimble-card-section--description *:first-child) {
		margin-block-start: 0 !important;
	}

	:global(.nimble-card-section--description *:last-child) {
		margin-block-end: 0 !important;
	}

	[data-heading-variant='section'] {
		--nimble-heading-margin: 0.75rem 0 0.25rem 0;
	}

	:global([data-heading-variant='section'] + *) {
		margin-block-start: 0;
	}
</style>
