<script>
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor';
	import { getRollModeSummary } from '../dataPreparationHelpers/getRollModeSummary';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip';

	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	const { messageDocument } = $props();
	const { system, rolls } = messageDocument;

	const headerBackgroundColor = messageDocument.author.color;
	const headerTextColor = calculateHeaderTextColor(headerBackgroundColor);

	const { savingThrows } = CONFIG.NIMBLE;
	const { actorType, permissions, rollMode, saveKey } = system;

	const label = `${savingThrows[saveKey]} Saving Throw`;
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
