<!--
@component
The Inventory tab: the coins, the inventory slots and Expand all in one line, then the objects by type.
You type a coin value in all modes. Create Object shows in all modes. The slots warn when you carry too much.
A stored object shows indented under its container. An Item dropped on the list, not on a row, goes in loose:
a stored object comes out of its container.
-->
<script lang="ts">
	import type { HeroInventoryTabProps } from '#types/components/actorSheets/HeroInventoryTab.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import InlineNumber from '../../parts/InlineNumber.svelte';
	import { droppedItemData } from '../../shared/drag.ts';
	import { setOpenRows } from '../../shared/sheetUiState.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform }: HeroInventoryTabProps = $props();

	const rowIds = $derived(view.groups.flatMap((group) => group.rows.map((row) => row.id)));
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));

	function ondrop(event: DragEvent) {
		const data = droppedItemData(event.dataTransfer);
		if (!data) return;
		event.preventDefault();
		event.stopPropagation();
		void perform({ kind: 'dropItem', data, containerId: '' });
	}
</script>

<div class="bar">
	{#each view.coins as coin (coin.coin)}
		<span class="pill">
			<span class="dot {coin.coin}" aria-hidden="true"></span>
			<InlineNumber
				value={coin.value}
				label={coin.name}
				min={0}
				width="34px"
				onchange={(value) => perform({ kind: 'setCurrency', coin: coin.coin, value })}
			/>
			<span class="cl" aria-hidden="true">{coin.label}</span>
		</span>
	{/each}
	{#if view.slots}
		<span
			class="pill slots"
			class:over={!!view.slots.over}
			role="status"
			aria-label={view.slots.over ?? view.slots.label}
			data-tooltip={view.slots.over ?? view.slots.label}
		>
			{#if view.slots.over}<i class="fa-solid fa-triangle-exclamation"></i>{/if}
			{view.slots.text}
		</span>
	{/if}
</div>
<div class="bar">
	<button
		type="button"
		class="nimble-u-reset-button create"
		onclick={() => perform(view.createObject.intent)}
	>
		<i class="fa-solid fa-plus"></i>{view.createObject.label}
	</button>
	<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
</div>
<div class="list" role="presentation" ondragover={(event) => event.preventDefault()} {ondrop}>
	{#if view.empty}
		<p class="empty">{view.empty}</p>
	{:else}
		<HeroRowGroupList groups={view.groups} {ui} {perform} flow />
	{/if}
</div>

<style>
	.bar {
		width: var(--nimble-columns-width, auto);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0 0 6px;
	}
	.pill {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 24px;
		padding: 0 7px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		font: 700 0.75rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
		white-space: nowrap;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}
	.gp {
		background: linear-gradient(45deg, #f2d70c, #fff 56%, #fceb00);
	}
	.sp {
		background: linear-gradient(45deg, #a0a0a0, #e8e8e8 56%);
	}
	.cp {
		background: linear-gradient(135deg, #d19c35, #f7e6c5 50%, #e8b558);
	}
	.cl {
		font-size: 0.688rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.create {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		margin-right: auto;
		padding: 0 10px;
		border: 1px dashed var(--nimble-ui-edge);
		border-radius: 4px;
		font: 700 0.75rem/1 var(--nimble-primary-font);
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
		font-size: 0.625rem;
	}
	.slots {
		margin-left: auto;
		letter-spacing: 0.04em;
	}
	.slots.over {
		border-color: var(--nimble-ui-warn);
		color: var(--nimble-ui-warn);
	}
	.list {
		min-height: 120px;
	}
	.empty {
		margin: 6px 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
