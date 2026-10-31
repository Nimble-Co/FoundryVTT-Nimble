<!--
@component
The Effects tab: the active effects, the conditions on you and the passive effects, each group with its count, then all conditions.
A row that ends at once does so on a click; a row that removes something asks first.
Any owner can turn a condition on or off. The arrow keys, Home and End move the focus in the condition grid.
-->
<script lang="ts">
	import type { HeroEffectsTabProps } from '#types/components/actorSheets/HeroEffectsTab.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import ConditionGrid from '../../shared/ConditionGrid.svelte';
	import { setOpenRows } from '../../shared/sheetUiState.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform }: HeroEffectsTabProps = $props();

	const rowIds = $derived(view.groups.flatMap((group) => group.rows.map((row) => row.id)));
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));
</script>

{#if rowIds.length}
	<div class="bar">
		<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
	</div>
{/if}
<HeroRowGroupList groups={view.groups} {ui} {perform} />
{#if view.empty}<p class="empty">{view.empty}</p>{/if}
<GroupHeading label={view.conditions.label} />
<ConditionGrid
	label={view.conditions.label}
	options={view.conditions.options}
	onpick={(condition) => perform(condition.intent)}
/>
{#if view.conditions.other.options.length}
	<GroupHeading label={view.conditions.other.label} plain />
	<ConditionGrid
		label={view.conditions.other.label}
		options={view.conditions.other.options}
		onpick={(condition) => perform(condition.intent)}
		compact
	/>
{/if}

<style>
	.bar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin: 0 0 6px;
	}
	.empty {
		margin: 0 4px 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
