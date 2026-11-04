<script lang="ts">
	import type { ChaosCardDoc, ChaosCardSystem, ChaosRollChoice } from '#types/chaos.d.ts';
	import type { ChaosCardProps } from '#types/components/ChaosCard.d.ts';

	import { canActOnCard, runCardAction } from '#utils/chat/cardActions.js';
	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument }: ChaosCardProps = $props();
	let busy = $state(false);

	const message = $derived(
		messageDocument as unknown as ChaosCardDoc & {
			isAuthor?: boolean;
			reactive: { author?: { color?: string }; system: ChaosCardSystem };
		},
	);
	const system = $derived(message.reactive.system);
	const headerBackgroundColor = $derived(message.reactive.author?.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor as never));
	const canAct = $derived(canActOnCard(message, fromUuidSync(system.actorUuid as never) as never));

	async function run(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		try {
			await action();
		} finally {
			busy = false;
		}
	}

	const choose = (choice: ChaosRollChoice) =>
		run(() => runCardAction(message as never, { name: 'chaosChoose', choice }));
	const keep = (index: number) =>
		run(() => runCardAction(message as never, { name: 'chaosKeep', index }));
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body nimble-chaos-card"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<h4 class="nimble-chaos-card__title">{localize('NIMBLE.chat.chaos.title')}</h4>

	{#if system.status === 'choosing' && canAct}
		<div class="nimble-chaos-card__buttons">
			<button
				class="nimble-button"
				data-button-variant="card-action"
				type="button"
				disabled={busy}
				onclick={() => choose('once')}
			>
				{localize('NIMBLE.chat.chaos.rollOnce')}
			</button>
			<button
				class="nimble-button"
				data-button-variant="card-action"
				type="button"
				disabled={busy}
				onclick={() => choose('both')}
			>
				{localize('NIMBLE.chat.chaos.rollTwiceBoth')}
			</button>
			<button
				class="nimble-button"
				data-button-variant="card-action"
				type="button"
				disabled={busy || system.chooseUses < 1}
				onclick={() => choose('choose')}
			>
				{localize('NIMBLE.chat.chaos.rollTwiceChoose')}
			</button>
		</div>
	{/if}

	{#each system.rolls as roll, index (index)}
		<div
			class="nimble-chaos-card__roll"
			class:nimble-chaos-card__roll--out={system.kept !== null && system.kept !== index}
		>
			<strong class="nimble-chaos-card__value">{roll.value}</strong>
			{#if roll.dropped !== null}
				<span
					class="nimble-chaos-card__dropped"
					data-tooltip={localize('NIMBLE.chat.chaos.advantageTooltip')}
				>
					({roll.dropped})
				</span>
			{/if}
			{#if roll.name}<strong>{roll.name}</strong>{/if}
			{#if system.status === 'picking' && canAct}
				<button
					class="nimble-button"
					data-button-variant="card-action"
					type="button"
					disabled={busy}
					onclick={() => keep(index)}
				>
					{localize('NIMBLE.chat.chaos.keep', { value: String(roll.value) })}
				</button>
			{/if}
			{#if roll.text}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="nimble-chaos-card__text">{@html roll.text}</div>
			{/if}
		</div>
	{/each}
</article>

<style lang="scss">
	.nimble-chaos-card {
		--nimble-card-action-color: var(--nimble-card-text-color, currentColor);

		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: var(--nimble-sm-text);

		&__title {
			margin: 0;
		}

		&__buttons {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__roll {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 0.25rem 0.375rem;

			&--out {
				opacity: 0.55;
				text-decoration: line-through;
			}
		}

		&__value {
			font-size: var(--nimble-md-text, 1rem);
		}

		&__dropped {
			color: var(--nimble-medium-text-color);
		}

		&__text {
			flex-basis: 100%;

			:global(p) {
				margin: 0;
			}
		}
	}
</style>
