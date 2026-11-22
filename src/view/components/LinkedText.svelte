<script lang="ts">
	import { type LinkedData, type LinkedPart, linkedParts } from '#utils/documents/docLink.ts';
	import DocumentLink from './DocumentLink.svelte';

	type Props =
		| { parts: readonly LinkedPart[]; key?: never; data?: never }
		| { key: string; data?: LinkedData; parts?: never };

	let { parts, key, data }: Props = $props();

	const shown = $derived(parts ?? linkedParts(key ?? '', data));
</script>

{#each shown as part, index (index)}{#if typeof part === 'string'}{part}{:else}<DocumentLink
			link={part}
		/>{/if}{/each}
