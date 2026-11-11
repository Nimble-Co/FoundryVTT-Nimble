<script lang="ts">
	import { SYSTEM_ID } from '#system';
	import { freeUseReasonText } from '#utils/chat/freeUseReason.js';
	import { getContext } from 'svelte';

	const messageDocument = getContext('messageDocument') as
		| { reactive?: { flags?: Record<string, { freeUseReason?: unknown } | undefined> } }
		| undefined;

	let line = $derived(
		freeUseReasonText(messageDocument?.reactive?.flags?.[SYSTEM_ID]?.freeUseReason),
	);
</script>

{#if line}
	<section class="nimble-card-section nimble-free-use-line">{line}</section>
{/if}

<style lang="scss">
	.nimble-free-use-line {
		font-size: var(--nimble-sm-text, 0.833rem);
		font-style: italic;
	}
</style>
