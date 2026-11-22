<script>
	import { setContext, untrack } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import ActionDeltaSummaryNode from './components/ActionDeltaSummaryNode.svelte';
	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import FreeUseLine from './components/FreeUseLine.svelte';
	import CardEvents from './components/CardEvents.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import CostLines from './components/CostLines.svelte';
	import ChaosButton from './components/ChaosButton.svelte';
	import ChargeConsumptionNode from './components/ChargeConsumptionNode.svelte';
	import { cardPrimaryRoll } from './components/attackOutcomeTags.ts';
	import ConcentrationNode from './components/ConcentrationNode.svelte';
	import GrantedActionOffers from './components/GrantedActionOffers.svelte';
	import IncomingReactionPrompts from './components/IncomingReactionPrompts.svelte';
	import ItemCardEffects from './components/ItemCardEffects.svelte';
	import Targets from './components/Targets.svelte';
	import TemplateSection from './components/TemplateSection.svelte';
	import { cardMeta } from './cardMeta.ts';
	import { setTargetsSectionShown } from './targetsSection.ts';

	function getUpcastingDescriptionLabel(tier, content) {
		if (!content) return null;
		if (tier === 0) return 'At Higher Levels';
		return 'Upcasting';
	}

	let { messageDocument } = $props();

	let { description, image, spellName, tier, upcast } = $derived(messageDocument.reactive.system);

	let headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	let headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
	let subheading = $derived(cardMeta(messageDocument.reactive, { showsHealing: true }));
	let itemUuid = $derived(messageDocument.reactive.flags?.[SYSTEM_ID]?.itemUuid ?? null);

	let higherLevelContent = $derived(description.higherLevelEffect);
	let upcastContent = $derived(tier > 0 ? description.upcastEffect : '');
	let higherLevelLabel = $derived(getUpcastingDescriptionLabel(0, higherLevelContent));
	let upcastLabel = $derived(getUpcastingDescriptionLabel(tier, upcastContent));

	let hasUpcast = $derived(upcast?.isUpcast);
	let upcastSummary = $derived(() => {
		if (!hasUpcast) return null;
		const parts = [`Upcast to level ${upcast.manaSpent}`];
		if (upcast.choiceLabel) {
			parts.push(upcast.choiceLabel);
		}
		return parts.join(', ');
	});

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
	setTargetsSectionShown(true);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader
		alt={spellName}
		heading={spellName}
		headingUuid={itemUuid}
		image={image || 'icons/svg/item-bag.svg'}
		{subheading}
	/>

	<CostLines />

	<FreeUseLine />

	<Targets />

	<TemplateSection {messageDocument} name={spellName} />

	{#if description.baseEffect || higherLevelContent || upcastContent}
		<section class="nimble-card-section nimble-card-section--description">
			{#if description.baseEffect}
				{@html description.baseEffect}
			{:else}
				No description available.
			{/if}

			{#if higherLevelContent}
				<h4 class="nimble-heading" data-heading-variant="section">
					{higherLevelLabel}
				</h4>

				{@html higherLevelContent}
			{/if}

			{#if upcastContent}
				<h4 class="nimble-heading" data-heading-variant="section">
					{upcastLabel}
				</h4>

				{@html upcastContent}
			{/if}
		</section>
	{/if}

	<ItemCardEffects />

	<GrantedActionOffers />

	{#if !cardPrimaryRoll(messageDocument.reactive.system)}
		<ChaosButton />
	{/if}
	<IncomingReactionPrompts place="options" />

	<ChargeConsumptionNode />

	<ActionDeltaSummaryNode />

	<ConcentrationNode />

	{#if hasUpcast}
		<section class="nimble-card-section nimble-upcast-indicator">
			<i class="fa-solid fa-arrow-up-right-dots"></i>
			{upcastSummary()}
		</section>
	{/if}

	<CardEvents {messageDocument} />
</article>

<style>
	.nimble-upcast-indicator {
		--nimble-card-section-padding: 0.5rem;

		background: var(--nimble-chat-upcast-background);
		color: var(--nimble-chat-upcast-color);
		font-weight: 600;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	[data-heading-variant='section'] {
		--nimble-heading-margin: 0.75rem 0 0.25rem 0;
	}

	:global([data-heading-variant='section'] + *) {
		margin-block-start: 0;
	}
</style>
