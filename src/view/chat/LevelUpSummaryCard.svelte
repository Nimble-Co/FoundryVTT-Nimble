<script>
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	let { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const rolls = $derived(messageDocument.reactive.rolls);
	const actorType = $derived(system.actorType);
	const currentClassLevel = $derived(system.currentClassLevel);
	const takeAverageHp = $derived(system.takeAverageHp);
	const hitDiceAdvantageSource = $derived(system.hitDiceAdvantageSource);
	const permissions = $derived(system.permissions);

	const hitPointsSubheading = $derived.by(() => {
		if (takeAverageHp) return 'Chose Average';
		if (hitDiceAdvantageSource) return `Rolled with advantage (${hitDiceAdvantageSource})`;
		return 'Rolled';
	});

	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader
		fa={true}
		image="fa-solid fa-arrow-up-right-dots"
		heading="Level Up Summary ({currentClassLevel} → {currentClassLevel + 1})"
	/>

	<section class="nimble-card-section">
		{#if rolls.length}
			<RollSummary
				label="Hit Points"
				subheading={hitPointsSubheading}
				tooltip={prepareRollTooltip(actorType, permissions, rolls[0])}
				total={rolls[0].total}
			/>
		{/if}
	</section>
</article>

<style lang="scss">
	.nimble-card-section {
		display: flex;
		flex-direction: column;
		padding: 0.25rem;
	}
</style>
