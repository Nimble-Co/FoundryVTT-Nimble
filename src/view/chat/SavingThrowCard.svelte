<script>
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import CardHeader from './components/CardHeader.svelte';
	import CheckCardRolls from './components/CheckCardRolls.svelte';

	const { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const { saves } = CONFIG.NIMBLE;
	const saveKey = $derived(system.saveKey);

	const label = $derived(saves[`${saveKey}Save`]);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="check"
>
	<CheckCardRolls {messageDocument} {label} />
</article>
