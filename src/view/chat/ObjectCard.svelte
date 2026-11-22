<script>
	import { setContext, untrack } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import ActionDeltaSummaryNode from './components/ActionDeltaSummaryNode.svelte';
	import CardEvents from './components/CardEvents.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CostLines from './components/CostLines.svelte';
	import FreeUseLine from './components/FreeUseLine.svelte';
	import ChargeConsumptionNode from './components/ChargeConsumptionNode.svelte';
	import ConcentrationNode from './components/ConcentrationNode.svelte';
	import GrantedActionOffers from './components/GrantedActionOffers.svelte';
	import IncomingReactionPrompts from './components/IncomingReactionPrompts.svelte';
	import ItemCardEffects from './components/ItemCardEffects.svelte';
	import Targets from './components/Targets.svelte';
	import TemplateSection from './components/TemplateSection.svelte';
	import { cardMeta } from './cardMeta.ts';
	import { setTargetsSectionShown } from './targetsSection.ts';

	const { messageDocument } = $props();

	let headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	let headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	let { description, image, isIdentified, name } = $derived(messageDocument.reactive.system);

	let subheading = $derived(cardMeta(messageDocument.reactive));
	// An object that is not identified never opens its item.
	let itemUuid = $derived(
		isIdentified ? (messageDocument.reactive.flags?.[SYSTEM_ID]?.itemUuid ?? null) : null,
	);

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
		image={image || 'icons/svg/item-bag.svg'}
		alt={isIdentified ? name.public : name.unidentified}
		heading={isIdentified ? name.public : name.unidentified}
		headingUuid={itemUuid}
		{subheading}
	/>

	<CostLines />

	<FreeUseLine />

	<Targets />

	<TemplateSection {messageDocument} name={isIdentified ? name.public : name.unidentified} />

	{#if (isIdentified && description.public.length) || (!isIdentified && description.unidentified.length)}
		<section class="nimble-card-section nimble-card-section--description">
			{#if isIdentified}
				{@html description.public}
			{:else}
				{@html description.unidentified}
			{/if}
		</section>
	{/if}

	<ItemCardEffects />

	<GrantedActionOffers />

	<IncomingReactionPrompts place="options" />

	<ChargeConsumptionNode />

	<ActionDeltaSummaryNode />

	<ConcentrationNode />

	<CardEvents {messageDocument} />
</article>
