<script lang="ts">
	import type { InitiativeCardProps } from '#types/components/InitiativeCard.d.ts';

	import CardHeader from './components/CardHeader.svelte';
	import CheckCardRolls from './components/CheckCardRolls.svelte';
	import InitiativeManaLine from './components/InitiativeManaLine.svelte';

	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import { startingActionsLine } from './components/initiativeCardText.ts';

	const { messageDocument }: InitiativeCardProps = $props();

	const headerBackgroundColor = $derived(messageDocument.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
	const note = $derived(startingActionsLine(messageDocument.reactive));
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
	data-card-type="check"
>
	<CheckCardRolls {messageDocument} label={localize('NIMBLE.chat.initiative.label')} {note} />
	<InitiativeManaLine messageDocument={messageDocument as never} />
</article>
