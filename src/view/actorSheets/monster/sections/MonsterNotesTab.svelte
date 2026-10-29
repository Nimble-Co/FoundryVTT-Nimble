<!--
@component
The Notes tab: the notes of the monster in the Foundry `prose-mirror` editor (the sheet form saves it; you change it
only in edit mode), and the import credit line at the bottom.
-->
<script lang="ts">
	import type { MonsterNotesTabProps } from '#types/components/actorSheets/MonsterNotesTab.d.ts';

	let { view, ui }: MonsterNotesTabProps = $props();

	const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

	// The element reads its attributes and its enriched content only when it starts, so it comes in as markup.
	const editor = $derived(
		`<prose-mirror name="${escape(view.notes.field)}" value="${escape(view.notes.value)}" toggled${
			ui.editing ? '' : ' disabled'
		}>${view.notes.enriched}</prose-mirror>`,
	);
</script>

<section class="notes">
	<h3 class="k">{view.notes.label}</h3>
	{#if view.notes.empty && !ui.editing}
		<p class="empty">{view.notes.empty}</p>
	{:else}
		{#key editor}
			<div class="editor">{@html editor}</div>
		{/key}
	{/if}
	{#if view.credit}<p class="credit">{@html view.credit}</p>{/if}
</section>

<style>
	.notes {
		display: flex;
		flex-direction: column;
		gap: 6px;
		height: 100%;
		min-height: 160px;
	}
	.k {
		margin: 0;
		font-size: 0.786rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}
	.editor {
		flex: 1;
		min-height: 140px;
		line-height: 1.45;
	}
	.editor :global(prose-mirror) {
		height: 100%;
	}
	.empty {
		margin: 0;
		color: var(--nimble-ui-ink-muted);
	}
	.credit {
		margin: auto 0 0;
		padding-top: 8px;
		font-size: 0.786rem;
		font-style: italic;
		color: var(--nimble-ui-ink-muted);
	}
</style>
