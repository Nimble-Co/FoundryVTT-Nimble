<script lang="ts">
	import type { ChaosCardDoc, ChaosCardSystem, ChaosRollChoice } from '#types/chaos.d.ts';
	import type { ChaosCardProps } from '#types/components/ChaosCard.d.ts';

	import { canActOnCard, runCardAction } from '#utils/chat/cardActions.js';
	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

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
	const title = localize('NIMBLE.chat.chaos.title');
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
	data-card-type="check"
>
	{#if system.status === 'choosing'}
		<h3 class="nimble-chaos-card__title">{title}</h3>
	{/if}

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
		{@const notKept = system.kept !== null && system.kept !== index}
		<section class="nimble-chaos-card__roll" class:nimble-chaos-card__roll--out={notKept}>
			<RollSummary
				label={roll.name || title}
				note={notKept ? localize('NIMBLE.chat.chaos.notKept') : roll.name ? title : null}
				subheading={roll.dropped === null
					? null
					: localize('NIMBLE.chat.chaos.advantageDropped', { value: String(roll.dropped) })}
				total={roll.value}
			/>
			{#if roll.text}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="nimble-chaos-card__text">{@html roll.text}</div>
			{/if}
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
		</section>
	{/each}
</article>

<style lang="scss">
	.nimble-chaos-card {
		--nimble-card-action-color: var(--nimble-card-text-color, currentColor);

		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__title {
			margin: 0;
			color: inherit;
			font-size: var(--nimble-sm-text);
			font-weight: 900;
			line-height: 1;
			border: 0;
		}

		&__buttons {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__roll {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;

			& + & {
				padding-block-start: 0.5rem;
				border-block-start: 1px solid var(--nimble-card-border-color);
			}

			&--out {
				opacity: 0.7;
			}
		}

		&__text {
			font-size: var(--nimble-sm-text);
			line-height: 1.35;

			:global(p) {
				margin: 0;
			}

			:global(p + p) {
				margin-block-start: 0.25rem;
			}
		}
	}
</style>
