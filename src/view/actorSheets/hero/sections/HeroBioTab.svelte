<!--
@component
The Bio tab: age, height, weight and gender, then the notes. They read as text; edit mode shows the fields.
The notes are the Foundry `prose-mirror` editor; the sheet form saves it.
-->
<script lang="ts">
	import type { HeroBioTabProps } from '#types/components/actorSheets/HeroBioTab.d.ts';

	let { view, ui, perform }: HeroBioTabProps = $props();

	const uid = $props.id();

	const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

	// The element reads its attributes and its enriched content only when it starts, so it comes in as markup.
	const editor = $derived(
		`<prose-mirror name="${escape(view.notes.field)}" value="${escape(view.notes.value)}" toggled${
			ui.editing ? '' : ' disabled'
		}>${view.notes.enriched}</prose-mirror>`,
	);
</script>

<div class="bio">
	<dl class="details">
		{#each view.fields as field (field.detail)}
			<dt id="{uid}-{field.detail}">{field.label}</dt>
			<dd>
				{#if ui.editing}
					<input
						type="text"
						value={field.value}
						placeholder={view.notSet}
						aria-labelledby="{uid}-{field.detail}"
						onchange={(event) =>
							perform({
								kind: 'setDetail',
								detail: field.detail,
								value: event.currentTarget.value,
							})}
					/>
				{:else if field.value}
					{field.value}
				{:else}
					<span class="unset">{view.notSet}</span>
				{/if}
			</dd>
		{/each}
	</dl>
	<section class="notes">
		<h3>{view.notes.label}</h3>
		{#if view.notes.empty && !ui.editing}
			<p class="empty">{view.notes.empty}</p>
		{:else}
			{#key editor}
				<div class="editor" class:editing={ui.editing}>{@html editor}</div>
			{/key}
		{/if}
	</section>
</div>

<style>
	.bio {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 14px;
		min-height: 0;
	}
	.details {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		align-items: center;
		gap: 10px 14px;
		margin: 0;
	}
	dt,
	dd {
		display: flex;
		align-items: center;
		min-height: 26px;
		margin: 0;
	}
	dt {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--nimble-ui-ink-dim);
	}
	dd {
		font-size: 0.813rem;
		color: var(--nimble-ui-ink);
	}
	.unset,
	input::placeholder,
	.empty {
		font-style: italic;
		color: var(--nimble-ui-ink-muted);
	}
	input {
		all: unset;
		box-sizing: border-box;
		width: 100%;
		max-width: 280px;
		height: 26px;
		padding: 0 3px;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		font-size: 0.813rem;
		color: var(--nimble-ui-ink);
		cursor: text;
	}
	input:focus {
		border-bottom-style: solid;
		border-color: var(--nimble-ui-highlight);
	}
	h3 {
		margin: 0;
		border: 0;
		font-size: 0.688rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
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
	.editor.editing {
		padding: 6px 8px;
		border: 1px dashed var(--nimble-ui-ring);
		border-radius: 4px;
	}
	.editor.editing :global(button.toggle:enabled) {
		display: grid;
		place-items: center;
	}
	.editor :global(prose-mirror) {
		height: 100%;
	}
	.empty {
		margin: 0;
		font-size: 0.813rem;
	}
</style>
