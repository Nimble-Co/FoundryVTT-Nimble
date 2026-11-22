<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import LinkedText from '../../components/LinkedText.svelte';
	import { createRicochetLineState } from './RicochetLine.svelte.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	const ricochet = createRicochetLineState(() => messageDocument);
	const { act } = ricochet;
	const line = $derived(ricochet.line);
	const busy = $derived(ricochet.busy);
</script>

{#if line}
	<section class="nimble-effect nimble-ricochet">
		<p class="nimble-ricochet__text">
			<i class="fa-solid fa-arrows-turn-right" aria-hidden="true"></i>
			<span><LinkedText parts={line.parts} /></span>
		</p>
		{#if line.action}
			<button
				class="nimble-button"
				data-button-variant="card-action"
				style="--nimble-card-action-color: currentColor"
				type="button"
				disabled={busy}
				onclick={act}
			>
				{line.action.label}
			</button>
		{/if}
		{#if line.note}
			<p class="nimble-ricochet__note">{line.note}</p>
		{/if}
	</section>
{/if}

<style lang="scss">
	.nimble-ricochet {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;

		&__text {
			display: flex;
			align-items: baseline;
			gap: 0.375rem;
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
		}

		&__note {
			margin: 0;
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
