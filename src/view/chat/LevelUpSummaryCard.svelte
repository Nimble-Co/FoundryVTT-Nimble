<script>
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	let { messageDocument } = $props();
	let { system, rolls } = messageDocument;

	const {
		actorName: _actorName,
		actorType,
		currentClassLevel,
		takeAverageHp,
		permissions,
	} = system;

	const headerBackgroundColor = messageDocument.author.color;
	const headerTextColor = calculateHeaderTextColor(headerBackgroundColor);

	setContext('message', messageDocument);
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
				subheading={takeAverageHp ? 'Chose Average' : 'Rolled'}
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
