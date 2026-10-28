<!--
@component
The character sheet. It reads `source()` (the plain actor and context), keeps its UI state in `ui`, and sends each intent to `perform`.
Wide (560 px or more): the rail at the left and the tabs at the right. Narrow: a header, the tabs and a strip of meters.
In Foundry the Application gives the adapter, its `$state` and the Foundry dispatcher; a story gives fixtures and a logging `perform`.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import SheetTabs from '../parts/SheetTabs.svelte';
	import type { SheetUiState } from '../shared/sheetUiState.ts';
	import { heroCoreTab } from './heroCoreTab.ts';
	import type { HeroPerform } from './heroIntent.ts';
	import { heroRail } from './heroRail.ts';
	import type { HeroSource } from './heroSource.ts';
	import { heroTabs } from './heroTabs.ts';
	import HeroCoreTab from './sections/HeroCoreTab.svelte';
	import HeroHeader from './sections/HeroHeader.svelte';
	import HeroRail from './sections/HeroRail.svelte';
	import HeroStrip from './sections/HeroStrip.svelte';
	import localize from '#utils/localize.js';

	interface Props {
		source: () => HeroSource;
		ui: SheetUiState;
		perform: HeroPerform;
	}

	let { source, ui, perform }: Props = $props();

	const NARROW_BELOW = 560;
	const RAIL_WIDTH = 236;

	let root: HTMLElement | undefined = $state();
	let width = $state(720);

	const current = $derived(source());
	const wide = $derived(width >= NARROW_BELOW);
	const mainWidth = $derived(wide ? width - RAIL_WIDTH : width);
	const rail = $derived(heroRail(current.actor, current.context));
	const tabs = $derived(heroTabs(current.context));
	const core = $derived(heroCoreTab(current.actor, current.context));
	const slot = $derived(mainWidth / 8);
	const tabFit = $derived(slot >= 78 ? 'inline' : slot >= 50 ? 'stacked' : 'icon');

	$effect(() => {
		if (!root || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(([entry]) => {
			width = entry.contentRect.width;
		});
		observer.observe(root);
		return () => observer.disconnect();
	});

	$effect(() => {
		const flash = ui.flash;
		if (!flash || !root) return;
		let row: HTMLElement | null | undefined;
		const done = (event: AnimationEvent) => {
			if (row && event.target === row) delete row.dataset.flash;
		};
		void tick().then(() => {
			row = root?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(flash.rowId)}"]`);
			if (!row) return;
			row.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
			// a reflow between the two writes starts the animation again on a second reveal
			delete row.dataset.flash;
			void row.offsetWidth;
			row.dataset.flash = String(flash.serial);
			row.addEventListener('animationend', done);
		});
		return () => row?.removeEventListener('animationend', done);
	});
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
				{tabs}
				value={ui.tab}
				fit={tabFit}
				label={localize('NIMBLE.actorSheet.hero.tabs.label')}
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
						<b>{localize('NIMBLE.actorSheet.hero.frame.editing')}</b>
						{localize('NIMBLE.actorSheet.hero.frame.editingHint')}
					</span>
					<button
						type="button"
						class="nimble-u-reset-button done"
						onclick={() => {
							ui.editing = false;
							ui.confirm = null;
						}}
					>
						{localize('NIMBLE.actorSheet.hero.frame.done')}
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
