<!--
@component
The Features tab: the class with its subheadings, the ancestry, the background and the boons. The groups flow in columns.
In edit mode the bar has Create Feature.
-->
<script lang="ts">
	import type { HeroFeaturesTabProps } from '#types/components/actorSheets/HeroFeaturesTab.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import { setOpenRows } from '../../shared/sheetUiState.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform }: HeroFeaturesTabProps = $props();

	const rowIds = $derived(
		view.groups.flatMap((group) => [
			...group.rows.map((row) => row.id),
			...(group.subgroups ?? []).flatMap((sub) => sub.rows.map((row) => row.id)),
		]),
	);
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));
</script>

<div class="bar">
	{#if ui.editing}
		<button
			type="button"
			class="nimble-u-reset-button create"
			onclick={() => perform(view.createFeature.intent)}
		>
			<i class="fa-solid fa-plus"></i>{view.createFeature.label}
		</button>
	{/if}
	<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
</div>
{#if view.empty}
	<p class="empty">{view.empty}</p>
{:else}
	<HeroRowGroupList groups={view.groups} {ui} {perform} flow />
{/if}

<style>
	.bar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin: 0 0 6px;
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
		font: 700 0.857rem/1 var(--nimble-primary-font);
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
		font-size: 0.714rem;
	}
	.empty {
		margin: 6px 4px;
		font-size: 0.929rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
