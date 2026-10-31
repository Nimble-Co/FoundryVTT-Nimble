<!--
@component
The header of the narrow NPC sheet (below 560 px): the portrait at the right, the name and the line under it,
the HP and Temp plates, and icon buttons: Create Feature (edit mode) and Expand all on the Abilities tab, and the Edit switch.
In edit mode the name is a field, the portrait has a change button, and an outline on the line under the name opens
the monster window. It stays dark in both themes.
-->
<script lang="ts">
	import type { MonsterHeaderProps } from '#types/components/actorSheets/MonsterHeader.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import EditSwitch from '../../shared/EditSwitch.svelte';
	import SheetPortrait from '../../shared/SheetPortrait.svelte';
	import { setEditing } from '../../shared/sheetUiState.ts';
	import MonsterHitPoints from './MonsterHitPoints.svelte';

	let { view, ui, perform, expandAll, createFeature }: MonsterHeaderProps = $props();

	const editing = $derived(ui.editing);
</script>

<header class="nimble-chrome header" class:editing aria-label={view.text.label}>
	<SheetPortrait {view} form="header" />
	<div class="fade"></div>
	<div class="column">
		<div class="who">
			{#if editing}
				<button
					type="button"
					class="nimble-u-reset-button icon"
					aria-label={view.text.changePortrait}
					data-tooltip={view.text.changePortrait}
					onclick={(event) => perform({ kind: 'changePortrait', skipTokenizer: event.shiftKey })}
				>
					<i class="fa-solid fa-image"></i>
				</button>
				<input
					class="name-field"
					type="text"
					value={view.name}
					aria-label={view.text.name}
					onchange={(event) => perform({ kind: 'rename', name: event.currentTarget.value })}
				/>
			{:else}
				<h2>{view.name}</h2>
			{/if}
			<span class="meta">
				{view.meta}
				{#if editing && view.configure.metadata}
					{@const outline = view.configure.metadata}
					<EditZone
						inline
						short={outline.short}
						label={outline.label}
						onclick={() => perform(outline.intent)}
					/>
				{/if}
			</span>
		</div>
		<div class="plates">
			<MonsterHitPoints {view} {perform} {editing} compact />
			<span class="buttons">
				{#if editing && createFeature}
					<button
						type="button"
						class="nimble-u-reset-button icon"
						aria-label={createFeature.label}
						data-tooltip={createFeature.label}
						onclick={() => perform(createFeature.intent)}
					>
						<i class="fa-solid fa-plus"></i>
					</button>
				{/if}
				{#if expandAll}
					<ExpandAllButton compact allOpen={expandAll.allOpen} onclick={expandAll.onclick} />
				{/if}
				<EditSwitch compact {editing} {...view.edit} onclick={() => setEditing(ui, !ui.editing)} />
			</span>
		</div>
	</div>
</header>

<style>
	.header {
		position: relative;
		flex-shrink: 0;
		padding: 9px 10px;
		background: var(--nimble-ui-chrome);
		border-bottom: 1px solid var(--nimble-ui-line);
	}
	.fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to right, var(--nimble-ui-chrome) 54%, transparent 130%);
	}
	.column {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.who {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 2px 8px;
		padding-right: var(--nimble-sheet-controls, 58px);
	}
	h2 {
		margin: 0;
		border: none;
		font-size: 1.062rem;
		font-weight: 900;
		line-height: 1.1;
		color: var(--nimble-ui-highlight);
	}
	.meta {
		position: relative;
		font-size: 0.729rem;
		color: var(--nimble-ui-ink-muted);
	}
	.editing .who {
		align-items: center;
		gap: 12px 8px;
	}
	.editing .meta {
		padding-right: 4px;
	}
	.name-field {
		all: unset;
		box-sizing: border-box;
		min-width: 0;
		flex: 1 1 120px;
		padding: 0 3px;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		font-size: 1.062rem;
		font-weight: 900;
		line-height: 1.25;
		color: var(--nimble-ui-highlight);
		cursor: text;
	}
	.name-field:focus {
		background: var(--nimble-ui-well);
	}
	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink);
	}
	.icon:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.plates {
		display: flex;
		align-items: flex-end;
		gap: 5px;
	}
	.buttons {
		margin-left: auto;
		display: flex;
		gap: 5px;
	}
</style>
