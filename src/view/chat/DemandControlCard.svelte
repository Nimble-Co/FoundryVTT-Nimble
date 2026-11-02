<script lang="ts">
	import { openDemandControl } from '#utils/demandControl/openDemandControl.js';
	import { CONTROL_OPTIONS, type ControlOption } from '#utils/demandControl/demandControl.js';
	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument } = $props();

	const TEXT = 'NIMBLE.demandControl';
	const system = $derived(messageDocument.reactive.system);
	const headerBackgroundColor = $derived(messageDocument.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor as never));
	const gmRows = CONTROL_OPTIONS.filter((option) => option !== 'loseControl');

	async function doRow(option: ControlOption) {
		const actor = fromUuidSync(system.actorUuid);
		if (!actor) return;
		await messageDocument.update({ 'system.done': [...system.done, option] });
		await openDemandControl(actor as never, { locked: option });
	}
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-demand-control-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<h4 class="nimble-demand-control-card__title">
		{localize(`${TEXT}.title`)}: {localize(`${TEXT}.options.${system.option}.label`)}
	</h4>
	<p>{system.text}</p>

	{#if system.option === 'loseControl' && game.user?.isGM}
		{#each gmRows as option (option)}
			<button
				class="nimble-button"
				data-button-variant="card-action"
				type="button"
				disabled={system.done.includes(option)}
				onclick={() => doRow(option)}
			>
				{localize(`${TEXT}.options.${option}.label`)}
			</button>
		{/each}
	{/if}
</article>

<style lang="scss">
	.nimble-demand-control-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: var(--nimble-sm-text);

		&__title {
			margin: 0;
		}

		p {
			margin: 0;
		}
	}
</style>
