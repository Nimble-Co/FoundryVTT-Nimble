<!--
@component
The character sheet. It reads `source()` (the plain actor and context), keeps its UI state in `ui`, and sends each intent to `perform`.
Wide (560 px or more): the rail at the left and the tabs at the right. Narrow: a header, the tabs and a strip of meters.
In Foundry the Application gives the adapter, its `$state` and the Foundry dispatcher; a story gives fixtures and a logging `perform`.
-->
<script lang="ts">
	import type { HeroSheetProps } from '#types/components/actorSheets/HeroSheet.d.ts';
	import SheetTabs from '../parts/SheetTabs.svelte';
	import { flashRows, trackWidth } from '../shared/sheetFrame.svelte.ts';
	import { heroCoreTab } from './heroCoreTab.ts';
	import { heroFrame } from './heroFrame.ts';
	import { heroRail } from './heroRail.ts';
	import HeroCoreTab from './sections/HeroCoreTab.svelte';
	import HeroHeader from './sections/HeroHeader.svelte';
	import HeroRail from './sections/HeroRail.svelte';
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
	const frame = $derived(heroFrame(current.context));
	const core = $derived(heroCoreTab(current.actor, current.context));
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
		<nav class="tabs">
			<SheetTabs
				tabs={frame.tabs}
				value={ui.tab}
				fit={tabFit}
				label={frame.tabsLabel}
				onchange={(id) => {
					ui.tab = id;
					ui.confirm = null;
				}}
			/>
		</nav>
		{#if !wide}<HeroStrip meters={rail.meters} {ui} {perform} />{/if}
		<div class="body">
			{#if ui.editing}
				<div class="band" role="status">
					<i class="fa-solid fa-pen"></i>
					<span>
						<b>{frame.editBand.title}</b>
						{frame.editBand.hint}
					</span>
					<button
						type="button"
						class="nimble-u-reset-button done"
						onclick={() => {
							ui.editing = false;
							ui.confirm = null;
						}}
					>
						{frame.editBand.done}
					</button>
				</div>
			{/if}
			{#if ui.tab === 'core'}
				<HeroCoreTab
					view={core}
					editing={ui.editing}
					{perform}
					skillColumns={mainWidth >= 620 ? 3 : 2}
				/>
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
		font-size: 1rem;
		line-height: 1.25;
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
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 10px 14px 14px;
		scrollbar-width: thin;
		scrollbar-color: var(--nimble-ui-ring) transparent;
	}
	.band {
		position: sticky;
		top: -10px;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: -10px -14px 12px;
		padding: 6px 10px 6px 14px;
		border-bottom: 1px solid var(--nimble-ui-own);
		background:
			linear-gradient(var(--nimble-ui-own-background), var(--nimble-ui-own-background)),
			var(--nimble-sheet-background);
		font-size: 0.893rem;
		line-height: 1.3;
	}
	.band > i {
		font-size: 0.786rem;
		color: var(--nimble-ui-own);
	}
	.band b {
		font-weight: 800;
		color: var(--nimble-ui-own);
	}
	.done {
		flex: none;
		margin-left: auto;
		height: 26px;
		padding: 0 12px;
		border-radius: 4px;
		background: var(--nimble-crimson);
		font-size: 0.857rem;
		font-weight: 700;
		color: var(--nimble-ui-fill-ink);
	}
	.done:hover {
		filter: brightness(1.15);
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
