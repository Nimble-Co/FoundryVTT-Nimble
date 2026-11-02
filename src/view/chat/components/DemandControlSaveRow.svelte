<!--
@component
The Demand Control row on a save card, for the owner of the creature whose effect was saved against.
-->
<script lang="ts">
	import { runCardAction } from '#utils/chat/cardActions.js';
	import { saveRowActor } from '#utils/demandControl/demandControl.js';
	import { openDemandControl } from '#utils/demandControl/openDemandControl.js';
	import localize from '#utils/localize.js';

	let { messageDocument } = $props();

	const actor = $derived(saveRowActor(messageDocument.reactive));

	async function use() {
		if (!actor) return;
		await runCardAction(messageDocument, { name: 'demandControlUsed' });
		await openDemandControl(actor as never);
	}
</script>

{#if actor}
	<button type="button" class="nimble-demand-control-row" onclick={use}>
		<i class="fa-solid fa-hand" aria-hidden="true"></i>
		{localize('NIMBLE.demandControl.title')}
	</button>
{/if}
