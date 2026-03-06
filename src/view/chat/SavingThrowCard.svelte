<script>
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import { getRollModeSummary } from '../dataPreparationHelpers/getRollModeSummary.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	const { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const rolls = $derived(messageDocument.reactive.rolls);
	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const { saves } = CONFIG.NIMBLE;
	const actorType = $derived(system.actorType);
	const permissions = $derived(system.permissions);
	const rollMode = $derived(system.rollMode);
	const saveKey = $derived(system.saveKey);

	const label = $derived(saves[`${saveKey}Save`]);
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
