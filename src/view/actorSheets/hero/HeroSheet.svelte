<!--
@component
The character sheet. It reads `source()` (the plain actor and context), keeps its UI state in `ui`, and sends each intent to `perform`.
Wide (560 px or more): the rail at the left and the tabs at the right. Narrow: a header, the tabs and a strip of meters.
In Foundry the Application gives the adapter, its `$state` and the Foundry dispatcher; a story gives fixtures and a logging `perform`.
-->
<script lang="ts">
	import { setEditing, showTab } from '../shared/sheetUiState.ts';
	import type { HeroSheetProps } from '#types/components/actorSheets/HeroSheet.d.ts';
	import SheetTabs from '../parts/SheetTabs.svelte';
	import EditBand from '../shared/EditBand.svelte';
	import { flashRows, trackWidth } from '../shared/sheetFrame.svelte.ts';
	import { heroActionsTab } from './heroActionsTab.ts';
	import { heroBioTab } from './heroBioTab.ts';
	import { heroCoreTab } from './heroCoreTab.ts';
	import { heroEffectsTab } from './heroEffectsTab.ts';
	import { heroFeaturesTab } from './heroFeaturesTab.ts';
	import { heroFrame } from './heroFrame.ts';
	import { heroInventoryTab } from './heroInventoryTab.ts';
	import { heroRail } from './heroRail.ts';
	import { heroSettingsTab } from './heroSettingsTab.ts';
	import { heroSpellsTab } from './heroSpellsTab.ts';
	import HeroActionsTab from './sections/HeroActionsTab.svelte';
	import HeroBioTab from './sections/HeroBioTab.svelte';
	import HeroCoreTab from './sections/HeroCoreTab.svelte';
	import HeroEffectsTab from './sections/HeroEffectsTab.svelte';
	import HeroFeaturesTab from './sections/HeroFeaturesTab.svelte';
	import HeroHeader from './sections/HeroHeader.svelte';
	import HeroInventoryTab from './sections/HeroInventoryTab.svelte';
	import HeroRail from './sections/HeroRail.svelte';
	import HeroSettingsTab from './sections/HeroSettingsTab.svelte';
	import HeroSpellsTab from './sections/HeroSpellsTab.svelte';
	import HeroStrip from './sections/HeroStrip.svelte';

	let { source, ui, perform }: HeroSheetProps = $props();

	const NARROW_BELOW = 560;
	const RAIL_WIDTH = 236;

	let root: HTMLElement | undefined = $state();
	const size = trackWidth(() => root, 720);
	flashRows(
		() => root,
		() => ui.flash,
	);

	const current = $derived(source());
	const wide = $derived(size.width >= NARROW_BELOW);
	const mainWidth = $derived(wide ? size.width - RAIL_WIDTH : size.width);
	const rail = $derived(heroRail(current.actor, current.context));
	const frame = $derived(heroFrame(current.actor, current.context));
	// each tab view is worked out only while its tab shows
	const core = $derived(ui.tab === 'core' ? heroCoreTab(current.actor, current.context) : null);
	const actions = $derived(
		ui.tab === 'actions' ? heroActionsTab(current.actor, current.context) : null,
	);
	const features = $derived(
		ui.tab === 'features' ? heroFeaturesTab(current.actor, current.context) : null,
	);
	const inventory = $derived(
		ui.tab === 'inventory' ? heroInventoryTab(current.actor, current.context) : null,
	);
	const spells = $derived(
		ui.tab === 'spells' ? heroSpellsTab(current.actor, current.context) : null,
	);
	const effects = $derived(
		ui.tab === 'effects' ? heroEffectsTab(current.actor, current.context) : null,
	);
	const bio = $derived(ui.tab === 'bio' ? heroBioTab(current.actor, current.context) : null);
	const settings = $derived(
		ui.tab === 'settings' ? heroSettingsTab(current.actor, current.context) : null,
	);
	const wideMain = $derived(mainWidth >= 620);
	const slot = $derived(mainWidth / 8);
	const tabFit = $derived(slot >= 78 ? 'inline' : slot >= 50 ? 'stacked' : 'icon');
</script>

<div class="hero" class:wide class:narrow={!wide} bind:this={root}>
	{#if wide}
		<HeroRail view={rail} {ui} {perform} />
	{:else}
		<HeroHeader view={rail} {ui} {perform} />
	{/if}
	<main>
		<div class="tabs">
			<SheetTabs
				tabs={frame.tabs}
				value={ui.tab}
				fit={tabFit}
				label={frame.tabsLabel}
				onchange={(id) => showTab(ui, id)}
			/>
		</div>
		{#if !wide}<HeroStrip meters={rail.meters} {ui} {perform} />{/if}
		<div class="body" class:fill={!!bio}>
			{#if ui.editing}
				<EditBand {...frame.editBand} ondone={() => setEditing(ui, false)} />
			{/if}
			{#if core}
				<HeroCoreTab view={core} editing={ui.editing} {perform} skillColumns={wideMain ? 3 : 2} />
			{:else if actions}
				<HeroActionsTab view={actions} {ui} {perform} columns={wideMain ? 2 : 1} />
			{:else if features}
				<HeroFeaturesTab view={features} {ui} {perform} />
			{:else if inventory}
				<HeroInventoryTab view={inventory} {ui} {perform} />
			{:else if spells}
				<HeroSpellsTab view={spells} {ui} {perform} />
			{:else if effects}
				<HeroEffectsTab view={effects} {ui} {perform} />
			{:else if bio}
				<HeroBioTab view={bio} {ui} {perform} />
			{:else if settings}
				<HeroSettingsTab view={settings} {perform} />
			{/if}
		</div>
	</main>
</div>

<style>
	.hero {
		display: flex;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--nimble-sheet-background);
		color: var(--nimble-ui-ink);
		font-size: 0.875rem;
		line-height: 1.25;
		--nimble-column: 340px;
		--nimble-column-gap: 24px;
		/* the list tabs: columns of one width that never stretch, so a row keeps its width when the window grows;
		   one column fills the tab. --nimble-columns-width is the width of the columns that fit. */
		--nimble-columns-width: max(
			calc(
				round(
						down,
						100% + var(--nimble-column-gap),
						var(--nimble-column) + var(--nimble-column-gap)
					) -
					var(--nimble-column-gap)
			),
			min(100%, calc(2 * var(--nimble-column) + var(--nimble-column-gap) - 1px))
		);
	}
	.narrow {
		flex-direction: column;
	}
	main {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.tabs {
		flex-shrink: 0;
		padding: 0 6px;
		border-bottom: 1px solid var(--nimble-ui-soft);
		white-space: nowrap;
	}
	.wide .tabs {
		padding-right: var(--nimble-sheet-controls, 6px);
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 10px 14px 14px;
		scrollbar-width: thin;
		scrollbar-color: var(--nimble-ui-ring) transparent;
	}
	.body.fill {
		display: flex;
		flex-direction: column;
	}
	.hero :global([data-row-id][data-flash]) {
		animation: hero-flash 1.2s ease-out;
	}
	@keyframes hero-flash {
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
