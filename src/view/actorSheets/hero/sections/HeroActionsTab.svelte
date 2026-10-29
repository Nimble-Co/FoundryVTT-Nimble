<!--
@component
The Actions tab: what you do on your turn (weapons, features, spells in combat, heroic actions) and the reactions.
At a wide tab the reactions are in a second column. In one column the reactions come first when it is not your turn.
-->
<script lang="ts">
	import type { HeroActionsTabProps } from '#types/components/actorSheets/HeroActionsTab.d.ts';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import { setOpenRows } from '../../shared/sheetUiState.ts';
	import HeroRowGroupList from './HeroRowGroupList.svelte';

	let { view, ui, perform, columns }: HeroActionsTabProps = $props();

	const rowIds = $derived(
		[...view.turnGroups, ...view.reactionGroups].flatMap((group) =>
			group.rows.map((row) => row.id),
		),
	);
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));
	const lists = $derived(
		columns === 1 && view.reactionsFirst
			? [view.reactionGroups, view.turnGroups]
			: [view.turnGroups, view.reactionGroups],
	);
</script>

<div class="bar">
	<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
</div>
<div class="lists" class:two={columns === 2}>
	{#each lists as groups, index (index)}
		<HeroRowGroupList {groups} {ui} {perform} />
	{/each}
</div>

<style>
	.bar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin: 0 0 6px;
	}
	.two {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0 24px;
		align-items: start;
	}
</style>
