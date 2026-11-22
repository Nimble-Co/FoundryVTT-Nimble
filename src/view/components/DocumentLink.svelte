<script lang="ts">
	import type { DocumentLinkProps } from '#types/components/DocumentLink.d.ts';

	import { linkedDocument } from '#utils/documents/docLink.ts';

	let { link }: DocumentLinkProps = $props();

	const target = $derived(linkedDocument(link));

	function openOnKey(event: KeyboardEvent): void {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).click();
	}
</script>

<!-- No href: Foundry opens any a[href] in a new tab. Its own body listener opens a[data-link]. -->
{#if target}<!-- svelte-ignore a11y_missing_attribute --><a
		class="content-link nimble-doc-link"
		role="link"
		tabindex="0"
		onkeydown={openOnKey}
		draggable="true"
		data-link=""
		data-uuid={target.uuid}
		data-id={target.id ?? undefined}
		data-type={target.documentName}
		data-pack={target.pack ?? undefined}>{link.name}</a
	>{:else}{link.name}{/if}

<style lang="scss">
	// Reads as part of the line: the text around it sets the font and the colour.
	.nimble-doc-link {
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		color: inherit;
		font: inherit;
		white-space: normal;
		word-break: normal;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
		text-underline-offset: 0.15em;
		cursor: var(--cursor-pointer, pointer);

		&:hover {
			text-decoration-color: currentColor;
			text-shadow: none;
		}

		&:focus-visible {
			outline: 1px solid currentColor;
			outline-offset: 1px;
		}
	}
</style>
