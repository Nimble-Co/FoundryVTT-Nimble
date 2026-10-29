<!--
@component
The Bio tab, as today: age, height, weight and gender, then the notes. You change them only in edit mode.
The notes are the Foundry `prose-mirror` editor; the sheet form saves it.
-->
<script lang="ts">
	import type { HeroBioTabProps } from '#types/components/actorSheets/HeroBioTab.d.ts';

	let { view, ui, perform }: HeroBioTabProps = $props();

	const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

	// The element reads its attributes and its enriched content only when it starts, so it comes in as markup.
	const editor = $derived(
		`<prose-mirror name="${escape(view.notes.field)}" value="${escape(view.notes.value)}" toggled${
			ui.editing ? '' : ' disabled'
		}>${view.notes.enriched}</prose-mirror>`,
	);
</script>

<div class="bio">
	<div class="fields">
		{#each view.fields as field (field.detail)}
			<label class="field">
				<span class="k">{field.label}</span>
				<input
					type="text"
					value={field.value}
					disabled={!ui.editing}
					onchange={(event) =>
						perform({ kind: 'setDetail', detail: field.detail, value: event.currentTarget.value })}
				/>
			</label>
		{/each}
	</div>
	<section class="notes">
		<h3 class="k">{view.notes.label}</h3>
		{#if view.notes.empty && !ui.editing}
			<p class="empty">{view.notes.empty}</p>
		{:else}
			{#key editor}
				<div class="editor">{@html editor}</div>
			{/key}
		{/if}
	</section>
</div>

<style>
	.bio {
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.k {
		margin: 0;
		font-size: 0.786rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}
	input {
		height: 28px;
		padding: 0 7px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		background: transparent;
		font: inherit;
		color: var(--nimble-ui-ink);
	}
	input:disabled {
		border-color: transparent;
		background: var(--nimble-ui-well);
		color: var(--nimble-ui-ink);
	}
	.notes {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 6px;
		min-height: 160px;
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
</style>
