<script lang="ts">
	import { SYSTEM_ID } from '#system';
	import { getContext } from 'svelte';

	const messageDocument = getContext('messageDocument') as
		| { reactive?: { flags?: Record<string, { freeUseReason?: unknown } | undefined> } }
		| undefined;

	let reason = $derived(messageDocument?.reactive?.flags?.[SYSTEM_ID]?.freeUseReason);
</script>

{#if typeof reason === 'string' && reason}
	<section class="nimble-card-section nimble-free-use-line">{reason}</section>
{/if}

<style lang="scss">
	.nimble-free-use-line {
		font-size: var(--nimble-sm-text, 0.833rem);
		font-style: italic;
	}
</style>
