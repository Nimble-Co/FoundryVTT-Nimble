<script>
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import { getRollModeSummary } from '../dataPreparationHelpers/getRollModeSummary.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	const { messageDocument } = $props();
	const { system, rolls } = messageDocument;

	const headerBackgroundColor = messageDocument.author.color;
	const headerTextColor = calculateHeaderTextColor(headerBackgroundColor);

	const { abilityScores } = CONFIG.NIMBLE;
	const { abilityKey, actorType, permissions, rollMode } = system;

	const label = `${abilityScores[abilityKey]} Check`;

	setContext('message', messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="check"
>
	{#each rolls as roll}
		<RollSummary
			{label}
			subheading={getRollModeSummary(rollMode)}
			tooltip={prepareRollTooltip(actorType, permissions, roll)}
			total={roll.total}
		/>
	{/each}
</article>
