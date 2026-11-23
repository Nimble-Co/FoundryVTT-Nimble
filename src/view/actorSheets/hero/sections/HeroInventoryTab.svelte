<!--
@component
The Inventory tab. My Inventory and Party Inventory sit above the coins.
Create Object and the slot count stay on My Inventory. The party stash has no slot limit.
The hand button beside the coins opens Give to.
A stored object shows indented under its container. An Item dropped on the list, not on a row, goes in loose:
a stored object comes out of its container.
-->
<script lang="ts">
	import type { HeroInventoryTabProps } from '#types/components/actorSheets/HeroInventoryTab.d.ts';
	import type { HeroIntent } from '../heroIntent.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import InlineNumber from '../../parts/InlineNumber.svelte';
	import { droppedItemData } from '../../shared/drag.ts';
	import { setOpenRows, setPartyInventory } from '../../shared/sheetUiState.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform }: HeroInventoryTabProps = $props();

	const rowIds = $derived(view.groups.flatMap((group) => group.rows.map((row) => row.id)));
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));
	let giveOpen = $state(false);

	function showList(party: boolean) {
		giveOpen = false;
		setPartyInventory(ui, party);
	}

	function chooseGive(intent: HeroIntent) {
		giveOpen = false;
		void perform(intent);
	}

	function ondrop(event: DragEvent) {
		if (view.party) return;
		const data = droppedItemData(event.dataTransfer);
		if (!data) return;
		event.preventDefault();
		event.stopPropagation();
		void perform({ kind: 'dropItem', data, containerId: '' });
	}

	$effect(() => {
		if (!giveOpen) return;
		const button = document.getElementById('nimble-give-coins');
		const menu = () => document.getElementById('nimble-give-coins-menu');
		const closeFrom = (event: Event) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (button?.contains(target) || menu()?.contains(target)) return;
			giveOpen = false;
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			giveOpen = false;
		};
		document.addEventListener('pointerdown', closeFrom, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', closeFrom, true);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="tabs" role="tablist" aria-label={view.listsLabel}>
	<button
		type="button"
		form=""
		role="tab"
		class="nimble-u-reset-button tab"
		aria-selected={!view.party}
		onclick={() => showList(false)}
	>
		{view.mineLabel}
	</button>
	<button
		type="button"
		form=""
		role="tab"
		class="nimble-u-reset-button tab"
		aria-selected={view.party}
		onclick={() => showList(true)}
	>
		{view.partyLabel}
	</button>
</div>
<div class="bar">
	{#each view.coins as coin (coin.coin)}
		<span class="pill">
			<span class="dot {coin.coin}" aria-hidden="true"></span>
			<InlineNumber
				value={coin.value}
				label={coin.name}
				min={0}
				width="34px"
				rest={view.coinsLocked}
				onchange={(value) =>
					perform(
						view.party
							? { kind: 'setPartyCurrency', coin: coin.coin, value }
							: { kind: 'setCurrency', coin: coin.coin, value },
					)}
			/>
			<span class="cl" aria-hidden="true">{coin.label}</span>
		</span>
	{/each}
	{#if view.currencyGive}
		{@const currencyGive = view.currencyGive}
		<span class="give">
			<button
				type="button"
				form=""
				id="nimble-give-coins"
				class="nimble-u-reset-button give-button"
				aria-label={currencyGive.label}
				data-tooltip={currencyGive.label}
				aria-haspopup="menu"
				aria-expanded={giveOpen}
				onclick={() => (giveOpen = !giveOpen)}
			>
				<i class="fa-solid fa-hand-holding-dollar"></i>
			</button>
			{#if giveOpen}
				<div
					id="nimble-give-coins-menu"
					class="menu"
					role="menu"
					tabindex="-1"
					onpointerdown={(event) => event.stopPropagation()}
				>
					{#if currencyGive.move}
						<div class="menu-label">{currencyGive.move.label}</div>
						{#each currencyGive.move.entries as entry (entry.id)}
							<button
								type="button"
								class="nimble-u-reset-button sub"
								role="menuitem"
								onclick={() => chooseGive(entry.intent)}
							>
								{entry.label}
							</button>
						{/each}
					{/if}
					{#if currencyGive.give}
						<div class="menu-label">{currencyGive.give.label}</div>
						{#each currencyGive.give.entries as entry (entry.id)}
							<button
								type="button"
								class="nimble-u-reset-button sub"
								role="menuitem"
								onclick={() => chooseGive(entry.intent)}
							>
								{entry.label}
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</span>
	{/if}
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
	<div class="tools">
		{#if !view.party}
			<button
				type="button"
				class="nimble-u-reset-button create"
				onclick={() => perform(view.createObject.intent)}
			>
				<i class="fa-solid fa-plus"></i>{view.createObject.label}
			</button>
		{/if}
	</div>
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
	.tabs {
		width: var(--nimble-columns-width, auto);
		display: flex;
		gap: 2px;
		margin: 0 0 6px;
		border-bottom: 1px solid var(--nimble-ui-line);
	}
	.tab {
		height: 28px;
		padding: 0 12px;
		border-bottom: 2px solid transparent;
		font: 700 0.75rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink-muted);
	}
	.tab[aria-selected='true'] {
		color: var(--nimble-ui-ink);
		border-bottom-color: var(--nimble-ui-own);
	}
	.tab:hover,
	.tab:focus-visible {
		color: var(--nimble-ui-ink);
		outline: none;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-right: auto;
	}
	.create {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 28px;
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
	.give {
		position: relative;
	}
	.give-button {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		color: var(--nimble-ui-ink);
	}
	.give-button:hover,
	.give-button:focus-visible,
	.give-button[aria-expanded='true'] {
		border-color: var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
		outline: none;
	}
	.menu {
		position: absolute;
		top: 28px;
		left: 0;
		z-index: 4;
		min-width: 11rem;
		padding: 4px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		background: var(--nimble-ui-raised);
		box-shadow: 0 8px 24px rgb(0 0 0 / 28%);
	}
	.menu button {
		display: block;
		width: 100%;
		padding: 6px 8px;
		border-radius: 3px;
		font: 600 0.75rem/1.2 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
		text-align: left;
		white-space: nowrap;
	}
	.menu button:hover,
	.menu button:focus-visible {
		background: var(--nimble-ui-hover);
		outline: none;
	}
	.menu-label {
		padding: 6px 8px 2px;
		font: 600 0.75rem/1.2 var(--nimble-primary-font);
		color: var(--nimble-ui-ink-muted);
	}
	.menu button.sub {
		padding-left: 16px;
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
