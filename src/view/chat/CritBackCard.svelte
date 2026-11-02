<script lang="ts">
	import { attackRows, useCritBack } from '#utils/damage/critBack.js';
	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const headerBackgroundColor = $derived(messageDocument.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor as never));
	const creature = $derived(fromUuidSync(system.actorUuid) as never);
	const rows = $derived(creature ? attackRows(creature) : []);

	async function use(itemId: string) {
		await messageDocument.update({ 'system.used': true });
		await useCritBack({
			creature,
			itemId,
			heroTokenUuid: system.heroTokenUuid,
			label: system.label,
		});
	}
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-crit-back-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<h4 class="nimble-crit-back-card__title">{system.label}</h4>
	<p>{system.text}</p>

	{#if !system.used && game.user?.isGM}
		{#each rows as row (row.id)}
			<button
				class="nimble-button"
				data-button-variant="card-action"
				type="button"
				onclick={() => use(row.id)}
			>
				{localize('NIMBLE.chat.critBack.attack', { attack: row.name })}
			</button>
		{/each}
	{/if}
</article>

<style lang="scss">
	.nimble-crit-back-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: var(--nimble-sm-text);

		&__title,
		p {
			margin: 0;
		}
	}
</style>
