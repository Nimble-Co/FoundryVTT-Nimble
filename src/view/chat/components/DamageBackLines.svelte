<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import { createDamageBackLinesState } from './DamageBackLines.svelte.ts';

	const messageDocument = getContext<NimbleChatMessage>('messageDocument');
	const lines = createDamageBackLinesState(() => messageDocument);
	const { canUse, textOf, buttonOf, doubleText, use } = lines;
</script>

{#each lines.records as record (record.id)}
	<div class="nimble-damage-back">
		<p class="nimble-damage-back__line">
			<i class="fa-solid fa-reply" aria-hidden="true"></i>
			{textOf(record)}
		</p>
		{#if canUse(record) && !record.dealt}
			<button class="nimble-button" type="button" onclick={() => use(record, 'deal')}>
				{buttonOf(record)}
			</button>
		{:else if canUse(record) && record.woundDoubles && !record.doubled}
			<button class="nimble-button" type="button" onclick={() => use(record, 'double')}>
				{doubleText(record)}
			</button>
		{/if}
	</div>
{/each}

<style lang="scss">
	.nimble-damage-back {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-block-start: 0.375rem;
		font-size: var(--nimble-sm-text);

		&__line {
			margin: 0;
			text-wrap: pretty;

			i {
				margin-inline-end: 0.25rem;
				font-size: 0.75em;
				opacity: 0.7;
			}
		}
	}
</style>
