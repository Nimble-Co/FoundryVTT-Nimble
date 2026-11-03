<script lang="ts">
	import type { ChatCardProps } from '#types/components/ChatCard.d.ts';
	import { openDemandControl } from '#utils/demandControl/openDemandControl.js';
	import { type ControlOption, windowOptions } from '#utils/demandControl/demandControl.js';
	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument }: ChatCardProps = $props();

	const TEXT = 'NIMBLE.demandControl';
	const system = $derived(
		messageDocument.reactive.system as unknown as { actorUuid: string; done: ControlOption[] },
	);
	const headerBackgroundColor = $derived(messageDocument.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor as never));
	const gmRows = $derived(
		windowOptions(fromUuidSync(system.actorUuid) as never).filter(
			(option) => option !== 'loseControl',
		),
	);

	async function doRow(option: ControlOption) {
		const actor = fromUuidSync(system.actorUuid);
		if (!actor) return;
		await messageDocument.update({ 'system.done': [...system.done, option] } as never);
		await openDemandControl(actor as never, { locked: option });
	}
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-demand-control-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader
		image="fa-solid fa-hand"
		fa
		heading={localize(`${TEXT}.title`)}
		subheading={localize(`${TEXT}.options.${system.option}.label`)}
	/>

	<section class="nimble-demand-control-card__section">
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
	</section>
</article>

<style lang="scss">
	.nimble-demand-control-card__section {
		--nimble-card-action-color: var(--nimble-card-text-color, currentColor);

		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: var(--nimble-card-section-padding, 0.5rem);
		font-size: var(--nimble-sm-text);

		p {
			margin: 0;
		}
	}
</style>
