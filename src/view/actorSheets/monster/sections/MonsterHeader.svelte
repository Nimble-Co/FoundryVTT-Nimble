<!--
@component
The header of the narrow NPC sheet (below 560 px): the portrait at the right, the name and the line under it,
the HP and Temp plates, and Expand all as an icon on the Abilities tab. It stays dark in both themes.
-->
<script lang="ts">
	import type { MonsterHeaderProps } from '#types/components/actorSheets/MonsterHeader.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import SheetPortrait from '../../shared/SheetPortrait.svelte';
	import MonsterHitPoints from './MonsterHitPoints.svelte';

	let { view, perform, expandAll }: MonsterHeaderProps = $props();
</script>

<header class="nimble-chrome header" aria-label={view.text.label}>
	<SheetPortrait {view} form="header" />
	<div class="fade"></div>
	<div class="column">
		<div class="who">
			<h2>{view.name}</h2>
			<span class="meta">{view.meta}</span>
		</div>
		<div class="plates">
			<MonsterHitPoints {view} {perform} compact />
			{#if expandAll}
				<span class="buttons">
					<ExpandAllButton compact allOpen={expandAll.allOpen} onclick={expandAll.onclick} />
				</span>
			{/if}
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
		padding-right: 58px;
	}
	h2 {
		margin: 0;
		border: none;
		font-size: 1.214rem;
		font-weight: 900;
		line-height: 1.1;
		color: var(--nimble-ui-highlight);
	}
	.meta {
		font-size: 0.833rem;
		color: var(--nimble-ui-ink-muted);
	}
	.plates {
		display: flex;
		align-items: flex-end;
		gap: 5px;
	}
	.buttons {
		margin-left: auto;
	}
</style>
