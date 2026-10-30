<!--
@component
The NPC sheet. It reads `source()` (the plain actor and context), keeps its UI state in `ui`, and sends each intent to `perform`.
Wide (560 px or more): the rail with the tabs at the left, the name and the tab at the right. Narrow: a header, the saves,
armor and speed, a strip of tabs, and the tab under them.
In Foundry the Application gives the adapter, its `$state` and the Foundry dispatcher; a story gives fixtures and a logging `perform`.
-->
<script lang="ts">
	import type { MonsterSheetProps } from '#types/components/actorSheets/MonsterSheet.d.ts';
	import SheetTabs from '../parts/SheetTabs.svelte';
	import EditBand from '../shared/EditBand.svelte';
	import { setEditing, showTab } from '../shared/sheetUiState.ts';
	import { createMonsterSheetState } from './monsterSheetState.svelte.ts';
	import MonsterAbilitiesTab from './sections/MonsterAbilitiesTab.svelte';
	import MonsterEffectsTab from './sections/MonsterEffectsTab.svelte';
	import MonsterHeader from './sections/MonsterHeader.svelte';
	import MonsterNotesTab from './sections/MonsterNotesTab.svelte';
	import MonsterRail from './sections/MonsterRail.svelte';
	import MonsterSettingsTab from './sections/MonsterSettingsTab.svelte';
	import MonsterTitle from './sections/MonsterTitle.svelte';

	let props: MonsterSheetProps = $props();
	const { ui, perform } = $derived(props);

	let root: HTMLElement | undefined = $state();
	const sheet = createMonsterSheetState(
		() => props,
		() => root,
	);
</script>

<div class="monster" class:wide={sheet.wide} class:narrow={!sheet.wide} bind:this={root}>
	{#if sheet.wide}
		<MonsterRail view={sheet.rail} frame={sheet.frame} {ui} {perform} />
	{:else}
		<MonsterHeader
			view={sheet.rail}
			{ui}
			{perform}
			expandAll={sheet.expandAll}
			createFeature={sheet.createFeature}
		/>
		<MonsterRail view={sheet.rail} frame={sheet.frame} {ui} {perform} narrow />
		<nav class="nimble-chrome strip">
			<SheetTabs
				layout="strip"
				tabs={sheet.frame.tabs}
				value={ui.tab}
				label={sheet.frame.tabsLabel}
				onchange={(id) => showTab(ui, id)}
			/>
		</nav>
	{/if}
	<main>
		{#if sheet.wide}
			<MonsterTitle
				view={sheet.rail}
				editing={ui.editing}
				{perform}
				expandAll={sheet.expandAll}
				createFeature={sheet.createFeature}
			/>
		{/if}
		<div class="body">
			{#if ui.editing}
				<EditBand {...sheet.frame.editBand} tight ondone={() => setEditing(ui, false)} />
			{/if}
			{#if sheet.abilities}
				<MonsterAbilitiesTab view={sheet.abilities} {ui} {perform} />
			{:else if sheet.effects}
				<MonsterEffectsTab view={sheet.effects} {ui} {perform} />
			{:else if sheet.notes}
				<MonsterNotesTab view={sheet.notes} {ui} />
			{:else if sheet.settings}
				<MonsterSettingsTab view={sheet.settings} {ui} {perform} />
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
