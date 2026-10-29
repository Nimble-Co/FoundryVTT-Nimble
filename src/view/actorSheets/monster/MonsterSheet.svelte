<!--
@component
The NPC sheet. It reads `source()` (the plain actor and context), keeps its UI state in `ui`, and sends each intent to `perform`.
Wide (560 px or more): the rail with the tabs at the left, the name and the tab at the right. Narrow: a header, the saves,
armor and speed, a strip of tabs, and the tab under them.
In Foundry the Application gives the adapter, its `$state` and the Foundry dispatcher; a story gives fixtures and a logging `perform`.
-->
<script lang="ts">
	import type { MonsterSheetProps } from '#types/components/actorSheets/MonsterSheet.d.ts';
	import ExpandAllButton from '../parts/ExpandAllButton.svelte';
	import SheetTabs from '../parts/SheetTabs.svelte';
	import { flashRows, trackWidth } from '../shared/sheetFrame.svelte.ts';
	import { setClosedRows, showTab } from '../shared/sheetUiState.ts';
	import { monsterAbilitiesTab } from './monsterAbilitiesTab.ts';
	import { monsterEffectsTab } from './monsterEffectsTab.ts';
	import { monsterFrame } from './monsterFrame.ts';
	import { monsterNotesTab } from './monsterNotesTab.ts';
	import { monsterRail } from './monsterRail.ts';
	import { monsterSettingsTab } from './monsterSettingsTab.ts';
	import MonsterAbilitiesTab from './sections/MonsterAbilitiesTab.svelte';
	import MonsterEffectsTab from './sections/MonsterEffectsTab.svelte';
	import MonsterHeader from './sections/MonsterHeader.svelte';
	import MonsterNotesTab from './sections/MonsterNotesTab.svelte';
	import MonsterRail from './sections/MonsterRail.svelte';
	import MonsterSettingsTab from './sections/MonsterSettingsTab.svelte';

	let { source, ui, perform }: MonsterSheetProps = $props();

	const NARROW_BELOW = 560;

	let root: HTMLElement | undefined = $state();
	const size = trackWidth(() => root, 660);
	flashRows(
		() => root,
		() => ui.flash,
	);

	const current = $derived(source());
	const wide = $derived(size.width >= NARROW_BELOW);
	const rail = $derived(monsterRail(current.actor, current.context));
	const frame = $derived(monsterFrame(current.actor, current.context));
	// each tab view is worked out only while its tab shows
	const abilities = $derived(
		ui.tab === 'abilities' ? monsterAbilitiesTab(current.actor, current.context) : null,
	);
	const effects = $derived(
		ui.tab === 'effects' ? monsterEffectsTab(current.actor, current.context) : null,
	);
	const notes = $derived(
		ui.tab === 'notes' ? monsterNotesTab(current.actor, current.context) : null,
	);
	const settings = $derived(
		ui.tab === 'settings' ? monsterSettingsTab(current.actor, current.context) : null,
	);
	const expandAll = $derived.by(() => {
		if (!abilities?.cardIds.length) return null;
		const ids = abilities.cardIds;
		const allOpen = ids.every((id) => !ui.closedRows.includes(id));
		return { allOpen, onclick: () => setClosedRows(ui, allOpen ? ids : []) };
	});
</script>

<div class="monster" class:wide class:narrow={!wide} bind:this={root}>
	{#if wide}
		<MonsterRail view={rail} {frame} {ui} {perform} />
	{:else}
		<MonsterHeader view={rail} {perform} {expandAll} />
		<MonsterRail view={rail} {frame} {ui} {perform} narrow />
		<nav class="nimble-chrome strip">
			<SheetTabs
				layout="strip"
				tabs={frame.tabs}
				value={ui.tab}
				label={frame.tabsLabel}
				onchange={(id) => showTab(ui, id)}
			/>
		</nav>
	{/if}
	<main>
		{#if wide}
			<header class="title">
				<div class="who">
					<h2>{rail.name}</h2>
					<span class="meta">{rail.meta}</span>
				</div>
				{#if expandAll}
					<ExpandAllButton size="sm" allOpen={expandAll.allOpen} onclick={expandAll.onclick} />
				{/if}
			</header>
		{/if}
		<div class="body">
			{#if abilities}
				<MonsterAbilitiesTab view={abilities} {ui} {perform} />
			{:else if effects}
				<MonsterEffectsTab view={effects} {ui} {perform} />
			{:else if notes}
				<MonsterNotesTab view={notes} {ui} />
			{:else if settings}
				<MonsterSettingsTab view={settings} {ui} {perform} />
			{/if}
		</div>
	</main>
</div>

<style>
	.monster {
		display: flex;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--nimble-sheet-background);
		color: var(--nimble-ui-ink);
		font-size: 1rem;
		line-height: 1.25;
	}
	.narrow {
		flex-direction: column;
		overflow-y: auto;
	}
	main {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.narrow main {
		flex: none;
	}
	.strip {
		flex-shrink: 0;
		border-bottom: 1px solid var(--nimble-ui-line);
	}
	.title {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px 6px 14px;
		border-bottom: 1px solid var(--nimble-ui-soft);
	}
	.who {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 2px 10px;
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
	.meta {
		font-size: 0.833rem;
		color: var(--nimble-ui-ink-muted);
		white-space: nowrap;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px 12px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--nimble-ui-ring) transparent;
	}
	.narrow .body {
		overflow: visible;
	}
	.monster :global([data-row-id][data-flash]) {
		animation: monster-flash 1.2s ease-out;
	}
	@keyframes monster-flash {
		from {
			background: var(--nimble-ui-own-background);
			box-shadow: inset 0 0 0 2px var(--nimble-ui-own);
		}
		to {
			background: transparent;
			box-shadow: inset 0 0 0 2px transparent;
		}
	}
</style>
