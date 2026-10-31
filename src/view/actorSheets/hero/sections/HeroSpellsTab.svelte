<!--
@component
The Spells tab: the spells by tier or by school. The groups flow in columns.
In edit mode the bar has Create Spell. The switch saves its choice on the character.
-->
<script lang="ts">
	import type { HeroSpellsTabProps } from '#types/components/actorSheets/HeroSpellsTab.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import ViewSwitch from '../../parts/ViewSwitch.svelte';
	import { setOpenRows } from '../../shared/sheetUiState.ts';
	import type { SpellsBy } from '../heroSource.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform }: HeroSpellsTabProps = $props();

	const rowIds = $derived(view.groups.flatMap((group) => group.rows.map((row) => row.id)));
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));
</script>

<div class="bar">
	{#if ui.editing}
		<button
			type="button"
			class="nimble-u-reset-button create"
			onclick={() => perform(view.createSpell.intent)}
		>
			<i class="fa-solid fa-plus"></i>{view.createSpell.label}
		</button>
	{/if}
	<ViewSwitch
		options={view.groupBy.options}
		value={view.by}
		label={view.groupBy.label}
		onchange={(value) => perform(view.groupBy.intents[value as SpellsBy])}
	/>
	<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
</div>
{#if view.empty}
	<p class="empty">{view.empty}</p>
{:else}
	<HeroRowGroupList groups={view.groups} {ui} {perform} flow />
{/if}

<style>
	.bar {
		width: var(--nimble-columns-width, auto);
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
	.empty {
		margin: 6px 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
