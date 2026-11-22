<script lang="ts">
	import type { LinkedTextProps } from '#types/components/LinkedText.d.ts';

	import { linkedParts } from '#utils/documents/docLink.ts';
	import DocumentLink from './DocumentLink.svelte';

	let { parts, key, data }: LinkedTextProps = $props();

	const shown = $derived(parts ?? linkedParts(key ?? '', data));
</script>

{#each shown as part, index (index)}{#if typeof part === 'string'}{part}{:else}<DocumentLink
			link={part}
		/>{/if}{/each}
