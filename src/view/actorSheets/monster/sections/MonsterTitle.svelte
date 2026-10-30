<!--
@component
The title bar of the wide NPC sheet: the name and the line under it, then Create Feature (edit mode) and Expand all
on the Abilities tab. In edit mode the name is a field, and an outline on the line opens the monster window.
-->
<script lang="ts">
	import type { MonsterTitleProps } from '#types/components/actorSheets/MonsterTitle.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';

	let { view, editing, perform, expandAll, createFeature }: MonsterTitleProps = $props();
</script>

<header class="title" class:editing>
	<div class="who">
		{#if editing}
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
	{#if editing && createFeature}
		<button
			type="button"
			class="nimble-u-reset-button create"
			onclick={() => perform(createFeature.intent)}
		>
			<i class="fa-solid fa-plus"></i>{createFeature.label}
		</button>
	{/if}
	{#if expandAll}
		<ExpandAllButton size="sm" allOpen={expandAll.allOpen} onclick={expandAll.onclick} />
	{/if}
</header>

<style>
	.title {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px 6px 14px;
		border-bottom: 1px solid var(--nimble-ui-soft);
	}
	.editing {
		padding-top: 10px;
		padding-bottom: 10px;
	}
	.who {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 2px 10px;
	}
	.editing .who {
		gap: 12px 16px;
	}
	h2 {
		margin: 0;
		border: none;
		font-size: 1.214rem;
		font-weight: 900;
		line-height: 1.1;
		color: var(--nimble-ui-highlight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.name-field {
		all: unset;
		box-sizing: border-box;
		min-width: 0;
		flex: 1 1 160px;
		padding: 0 3px;
		margin: 0 -3px;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		font-size: 1.214rem;
		font-weight: 900;
		line-height: 1.25;
		color: var(--nimble-ui-highlight);
		cursor: text;
	}
	.name-field:focus {
		background: var(--nimble-ui-well);
	}
	.meta {
		position: relative;
		font-size: 0.833rem;
		color: var(--nimble-ui-ink-muted);
		white-space: nowrap;
	}
	.editing .meta {
		padding-right: 4px;
	}
	.create {
		flex: none;
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border: 1px dashed var(--nimble-ui-edge);
		border-radius: 4px;
		font: 700 0.857rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.create:hover,
	.create:focus-visible {
		border-style: solid;
		border-color: var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
		outline: none;
	}
	.create i {
		font-size: 0.714rem;
	}
</style>
