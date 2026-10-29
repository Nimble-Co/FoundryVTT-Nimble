<!--
@component
The rail of the NPC sheet: the faded portrait, the HP and Temp plates (or the minion rules), the saves, armor and speed,
the damage and condition defenses, and the tabs at the bottom. A click on a save rolls it. The rail stays dark in both themes.
In the narrow form it has no portrait, no plates and no tabs: the header and the tab strip hold them.
-->
<script lang="ts">
	import type { MonsterRailProps } from '#types/components/actorSheets/MonsterRail.d.ts';
	import SaveTile from '../../parts/SaveTile.svelte';
	import SheetTabs from '../../parts/SheetTabs.svelte';
	import StatBox from '../../parts/StatBox.svelte';
	import SheetPortrait from '../../shared/SheetPortrait.svelte';
	import { showTab } from '../../shared/sheetUiState.ts';
	import MonsterHitPoints from './MonsterHitPoints.svelte';

	let { view, frame, ui, perform, narrow = false }: MonsterRailProps = $props();
</script>

<aside class="nimble-chrome rail" class:narrow aria-label={view.text.label}>
	{#if !narrow}
		<div class="portrait">
			<SheetPortrait {view} form="rail" />
			<div class="fade"></div>
		</div>
	{/if}
	<div class="scroll">
		{#if !narrow}<MonsterHitPoints {view} {perform} />{/if}
		{#if view.minionRules}
			<div class="box minion">
				<span class="label"><i class="fa-solid fa-users"></i>{view.text.minion}</span>
				{#each view.minionRules as rule (rule)}<span>{rule}</span>{/each}
			</div>
		{/if}
		<div class="saves">
			{#each view.saves as save (save.key)}
				<SaveTile
					ability={save.label}
					mod={save.mod}
					advantage={save.advantage}
					stripTone="card"
					onclick={() => perform(save.intent)}
				/>
			{/each}
		</div>
		<div class="stats">
			{#each view.stats as stat (stat.id)}
				<StatBox icon={stat.icon} label={stat.label} value={stat.value} tooltip={stat.tooltip} />
			{/each}
		</div>
		{#if view.defenses.length}
			<dl class="box defenses">
				{#each view.defenses as defense (defense.id)}
					<div class="defense {defense.id}">
						<dt class="label">{defense.label}</dt>
						<dd>{defense.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}
		{#if !narrow}
			<nav class="tabs">
				<SheetTabs
					layout="rail"
					tabs={frame.tabs}
					value={ui.tab}
					label={frame.tabsLabel}
					onchange={(id) => showTab(ui, id)}
				/>
			</nav>
		{/if}
	</div>
</aside>

<style>
	.rail {
		position: relative;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		width: 236px;
		min-height: 0;
		border-right: 1px solid var(--nimble-ui-line);
	}
	.narrow {
		width: auto;
		flex-shrink: 1;
		border-right: 0;
		border-bottom: 1px solid var(--nimble-ui-line);
	}
	.portrait {
		position: relative;
		flex-shrink: 0;
		height: 150px;
		margin-bottom: -40px;
		background: var(--nimble-ui-chrome);
	}
	.fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 40%, var(--nimble-ui-chrome) 98%);
	}
	.scroll {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0 12px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--nimble-ui-ring) transparent;
	}
	.narrow .scroll {
		flex: none;
		overflow: visible;
		padding: 8px 10px;
		gap: 8px;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin: 0;
		padding: 7px 9px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.893rem;
		line-height: 1.3;
		color: var(--nimble-ui-ink);
	}
	.label {
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		font-size: 0.679rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--nimble-bronze);
	}
	.saves {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
	}
	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
	}
	.narrow .stats {
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
	}
	.defense {
		display: grid;
		grid-template-columns: 76px 1fr;
		gap: 10px;
		align-items: baseline;
	}
	.defense + .defense {
		padding-top: 4px;
		border-top: 1px solid var(--nimble-ui-soft);
	}
	dd {
		margin: 0;
		font-size: 0.857rem;
		font-weight: 600;
	}
	.resist .label {
		color: var(--nimble-damage-badge-resistant-color);
	}
	.immune .label {
		color: var(--nimble-damage-badge-immune-color);
	}
	.vulnerable .label {
		color: var(--nimble-damage-badge-vulnerable-color);
	}
	.tabs {
		margin-top: auto;
		padding-top: 8px;
		border-top: 1px solid var(--nimble-ui-line);
	}
</style>
