<script>
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import CardEvents from './components/CardEvents.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import CheckCardRolls from './components/CheckCardRolls.svelte';

	import { escapeRollNote } from '#utils/lastsUntil/escapeFollow.js';

	const { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const { skills } = CONFIG.NIMBLE;
	const skillKey = $derived(system.skillKey);

	const label = $derived(`${skills[skillKey]} Check`);
	const note = $derived(escapeRollNote(messageDocument.reactive));
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="check"
>
	<CheckCardRolls {messageDocument} {label} {note} />

	<CardEvents {messageDocument} />
</article>
