<script>
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import CardEvents from './components/CardEvents.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import CheckCardRolls from './components/CheckCardRolls.svelte';
	import DemandControlSaveRow from './components/DemandControlSaveRow.svelte';

	import { escapeRollNote } from '#utils/lastsUntil/escapeFollow.js';
	import { requestedSaveNote } from '#utils/saveRequest/saveRequests.js';

	const { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const { saves } = CONFIG.NIMBLE;
	const saveKey = $derived(system.saveKey);

	const label = $derived(saves[`${saveKey}Save`]);
	const note = $derived(
		requestedSaveNote(messageDocument.reactive) ?? escapeRollNote(messageDocument.reactive),
	);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="check"
>
	<CheckCardRolls {messageDocument} {label} {note} />
	<DemandControlSaveRow {messageDocument} />

	<CardEvents {messageDocument} />
</article>
