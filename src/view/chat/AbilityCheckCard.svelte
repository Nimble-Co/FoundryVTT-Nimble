<script>
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import { getRollModeSummary } from '../dataPreparationHelpers/getRollModeSummary.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	const { messageDocument } = $props();

	const system = $derived(messageDocument.system);
	const rolls = $derived(messageDocument.rolls);
	const headerBackgroundColor = $derived(messageDocument.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const { abilityScores } = CONFIG.NIMBLE;
	const abilityKey = $derived(system.abilityKey);
	const actorType = $derived(system.actorType);
	const permissions = $derived(system.permissions);
	const rollMode = $derived(system.rollMode);

	const label = $derived(`${abilityScores[abilityKey]} Check`);

	$effect(() => {
		setContext('message', messageDocument);
	});
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
