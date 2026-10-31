<!--
@component
The rail of the NPC sheet: the faded portrait, the HP and Temp plates (or the minion rules), the saves, armor and speed,
the damage and condition defenses, and the tabs at the bottom. A click on a save rolls it. The rail stays dark in both themes.
In the narrow form it has no portrait, no plates and no tabs: the header and the tab strip hold them.
The Edit switch is last. In edit mode the plays rest (a save does not roll), you type the max HP, ARMOR is a select,
and quiet outlines on the saves, the speeds and the defenses open their configure windows.
-->
<script lang="ts">
	import type { MonsterRailProps } from '#types/components/actorSheets/MonsterRail.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import SaveTile from '../../parts/SaveTile.svelte';
	import SheetTabs from '../../parts/SheetTabs.svelte';
	import StatBox from '../../parts/StatBox.svelte';
	import EditSwitch from '../../shared/EditSwitch.svelte';
	import SheetPortrait from '../../shared/SheetPortrait.svelte';
	import { setEditing, showTab } from '../../shared/sheetUiState.ts';
	import MonsterHitPoints from './MonsterHitPoints.svelte';

	let { view, frame, ui, perform, narrow = false }: MonsterRailProps = $props();

	const editing = $derived(ui.editing);
	const [armor, ...speeds] = $derived(view.stats);
</script>

<aside class="nimble-chrome rail" class:narrow class:editing aria-label={view.text.label}>
	{#if !narrow}
		<div class="portrait">
			<SheetPortrait {view} form="rail" />
			<div class="fade"></div>
			{#if editing}
				<button
					type="button"
					class="nimble-u-reset-button change"
					aria-label={view.text.changePortrait}
					data-tooltip={view.text.changePortrait}
					onclick={(event) => perform({ kind: 'changePortrait', skipTokenizer: event.shiftKey })}
				>
					<i class="fa-solid fa-image"></i>
				</button>
			{/if}
		</div>
	{/if}
	<div class="scroll">
		{#if !narrow}<MonsterHitPoints {view} {perform} {editing} />{/if}
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
					onclick={editing ? undefined : () => perform(save.intent)}
				/>
			{/each}
			{#if editing && view.configure.saves}
				{@const outline = view.configure.saves}
				<EditZone
					short={outline.short}
					label={outline.label}
					onclick={() => perform(outline.intent)}
				/>
			{/if}
		</div>
		<div class="stats">
			{#if editing}
				<label class="armor">
					<span class="label"><i class={armor.icon}></i>{view.armor.label}</span>
					<select
						value={view.armor.value}
						onchange={(event) =>
							perform({
								kind: 'setArmor',
								armor: event.currentTarget.value as typeof view.armor.value,
							})}
					>
						{#each view.armor.options as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
			{:else}
				<StatBox
					icon={armor.icon}
					label={armor.label}
					value={armor.value}
					tooltip={armor.tooltip}
				/>
			{/if}
			<div class="speeds">
				{#each speeds as stat (stat.id)}
					<StatBox icon={stat.icon} label={stat.label} value={stat.value} tooltip={stat.tooltip} />
				{/each}
				{#if editing && view.configure.movement}
					{@const outline = view.configure.movement}
					<EditZone
						short={outline.short}
						label={outline.label}
						onclick={() => perform(outline.intent)}
					/>
				{/if}
			</div>
		</div>
		{#if view.defenses.length || editing}
			<div class="defenses-zone">
				<dl class="box defenses">
					{#each view.defenses as defense (defense.id)}
						<div class="defense {defense.id}">
							<dt class="label">{defense.label}</dt>
							<dd>{defense.value}</dd>
						</div>
					{:else}
						<dd class="none">{view.text.noDefenses}</dd>
					{/each}
				</dl>
				{#if editing && view.configure.defenses}
					{@const outline = view.configure.defenses}
					<EditZone
						short={outline.short}
						label={outline.label}
						onclick={() => perform(outline.intent)}
					/>
				{/if}
			</div>
		{/if}
		{#if !narrow}
			<div class="tabs">
				<SheetTabs
					layout="rail"
					tabs={frame.tabs}
					value={ui.tab}
					label={frame.tabsLabel}
					onchange={(id) => showTab(ui, id)}
				/>
			</div>
			<div class="switch">
				<EditSwitch {editing} {...view.edit} onclick={() => setEditing(ui, !ui.editing)} />
			</div>
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
		flex-shrink: 0;
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
	.change {
		position: absolute;
		top: 7px;
		left: 8px;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		background: var(--nimble-ui-scrim);
		font-size: 0.75rem;
		color: var(--nimble-ui-fill-ink);
	}
	.change:hover {
		background: var(--nimble-ui-scrim-strong);
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
		background: var(--nimble-ui-chrome);
		font-size: 0.781rem;
		line-height: 1.3;
		color: var(--nimble-ui-ink);
	}
	.label {
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		font-size: 0.594rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--nimble-bronze);
	}
	.editing .scroll {
		gap: 18px;
	}
	.saves,
	.speeds,
	.defenses-zone {
		position: relative;
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
	.speeds {
		display: contents;
	}
	.editing .stats {
		gap: 18px 5px;
	}
	.editing .speeds {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: inherit;
		gap: 5px;
	}
	.narrow .stats,
	.narrow.editing .speeds {
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
	}
	.armor {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 2px 3px 2px 8px;
		border: 1px dashed var(--nimble-ui-edge);
		border-radius: 4px;
	}
	.armor select {
		width: auto;
		height: 26px;
		border: none;
		background: var(--nimble-ui-well);
		font: 700 0.75rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.none {
		margin: 0;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);
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
		font-size: 0.75rem;
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
	.switch {
		display: flex;
		justify-content: flex-end;
	}
</style>
