<script>
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import localize from '../../utils/localize';

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

	function getSpellSchoolLabel(school) {
		return localize(spellSchools[school] ?? '');
	}

	function getSpellTierLabel(tier) {
		return localize(spellTiers[tier] ?? '');
	}

	function getUpcastingDescriptionLabel(tier, higherLevelEffectDescription) {
		if (!higherLevelEffectDescription) return null;
		if (tier === 0) return 'At Higher Levels';
		return 'Upcasting';
	}

	const { spellSchools, spellTiers } = CONFIG.NIMBLE;

	let { messageDocument } = $props();

	let { activation, description, image, isCritical, isMiss, school, spellName, tier } = $derived(
		messageDocument.reactive.system,
	);

	let headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	let headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
	let subheading = $derived(getCardSubheading(activation, isCritical, isMiss));

	let tierLabel = $derived(getSpellTierLabel(tier));
	let spellSchoolLabel = $derived(getSpellSchoolLabel(school));
	let upcastingLabel = $derived(getUpcastingDescriptionLabel(tier, description.higherLevelEffect));

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
</article>

<style>
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
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
