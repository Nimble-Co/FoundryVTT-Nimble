<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '#utils/localize.ts';

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	const isConcentrating = $derived(messageDocument?.reactive?.system?.concentration ?? false);
</script>

{#if isConcentrating}
	<section class="nimble-card-section nimble-concentration-indicator">
		<i class="fa-solid fa-brain"></i>

		{localize('NIMBLE.chat.concentrationApplied')}
	</section>
{/if}

<style lang="scss">
	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0.5rem);

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-concentration-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: var(--nimble-chat-concentration-background);
		color: var(--nimble-chat-concentration-color);
		font-weight: 600;
		text-align: center;
	}
</style>
