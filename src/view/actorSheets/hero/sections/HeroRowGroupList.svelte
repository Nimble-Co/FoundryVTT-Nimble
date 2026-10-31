<!--
@component
Groups of rows under their headings. A group hint is a muted line under its rows, and its subgroups
(the selection groups of a class) follow under quiet subheadings. With `none`, an empty group says so.
With `flow`, the groups flow in columns about 300 px wide, and a group never breaks over two columns.
-->
<script lang="ts">
	import type { HeroRowGroupListProps } from '#types/components/actorSheets/HeroRowGroupList.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import HeroRow from './HeroRow.svelte';

	let { groups, ui, perform, flow = false, none }: HeroRowGroupListProps = $props();
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
			{#if none && !group.rows.length}<p class="none">{none}</p>{/if}
			{#each group.rows as row (row.id)}
				<HeroRow {row} {ui} {perform} />
			{/each}
			{#if group.hint}<p class="hint">{group.hint}</p>{/if}
			{#each group.subgroups ?? [] as sub (sub.id)}
				<div class="sub">
					<GroupHeading label={sub.label} plain />
					{#each sub.rows as row (row.id)}
						<HeroRow {row} {ui} {perform} />
					{/each}
				</div>
			{/each}
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
	.sub {
		margin-top: 6px;
	}
	.none {
		margin: 6px 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink-muted);
	}
	.hint {
		margin: 4px 8px 0 34px;
		font-size: 0.781rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
	}
</style>
