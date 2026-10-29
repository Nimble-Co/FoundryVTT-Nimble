<!--
@component
Groups of rows under their headings, for the Actions and Spells tabs. A group hint is a muted line under its rows.
With `flow`, the groups flow in columns about 300 px wide, and a group never breaks over two columns.
-->
<script lang="ts">
	import type { HeroRowGroupListProps } from '#types/components/actorSheets/HeroRowGroupList.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import HeroRow from './HeroRow.svelte';

	let { groups, ui, perform, flow = false }: HeroRowGroupListProps = $props();
</script>

<div class="list" class:flow>
	{#each groups as group, index (group.id)}
		<section class="group">
			<GroupHeading
				label={group.label}
				note={group.note}
				noteTone="muted"
				now={group.now}
				flush={index === 0}
				editing={ui.editing}
			/>
			{#each group.rows as row (row.id)}
				<HeroRow {row} {ui} {perform} />
			{/each}
			{#if group.hint}<p class="hint">{group.hint}</p>{/if}
		</section>
	{/each}
</div>

<style>
	.list {
		min-width: 0;
	}
	.flow {
		column-width: 300px;
		column-gap: 24px;
	}
	.group {
		break-inside: avoid;
		margin-bottom: 8px;
	}
	.hint {
		margin: 4px 8px 0 34px;
		font-size: 0.893rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
	}
</style>
