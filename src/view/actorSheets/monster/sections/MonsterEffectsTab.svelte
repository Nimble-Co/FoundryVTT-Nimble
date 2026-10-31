<!--
@component
The Effects tab of the NPC sheet: the active effects, the conditions on the monster and the passive effects,
each group with its count, then all conditions. A toggle effect ends on a click; a row that removes something asks first.
The arrow keys, Home and End move the focus in the condition grid.
-->
<script lang="ts">
	import type { MonsterEffectsTabProps } from '#types/components/actorSheets/MonsterEffectsTab.d.ts';
	import ConfirmBar from '../../parts/ConfirmBar.svelte';
	import ExpandAllButton from '../../parts/ExpandAllButton.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import Row from '../../parts/Row.svelte';
	import type { EffectRowView } from '../../shared/effectsTab.ts';
	import ConditionGrid from '../../shared/ConditionGrid.svelte';
	import { askConfirm, closeConfirm, setOpenRows, toggleRow } from '../../shared/sheetUiState.ts';

	let { view, ui, perform }: MonsterEffectsTabProps = $props();

	const uid = $props.id();
	const rowIds = $derived(view.groups.flatMap((group) => group.rows.map((row) => row.id)));
	const allOpen = $derived(rowIds.length > 0 && rowIds.every((id) => ui.openRows.includes(id)));

	function use(row: EffectRowView) {
		if (row.use?.kind === 'act') void perform(row.use.intent);
		else if (row.use?.kind === 'ask') askConfirm(ui, `ask:${row.id}`);
	}

	function confirm(row: EffectRowView) {
		closeConfirm(ui);
		if (row.use?.kind === 'ask') void perform(row.use.ask.intent);
	}
</script>

{#if rowIds.length}
	<div class="bar">
		<ExpandAllButton {allOpen} onclick={() => setOpenRows(ui, allOpen ? [] : rowIds)} />
	</div>
{/if}
{#each view.groups as group, index (group.id)}
	<section class="group">
		<GroupHeading label={group.label} note={group.note} noteTone="muted" flush={index === 0} />
		{#each group.rows as row (row.id)}
			{@const asking =
				row.use?.kind === 'ask' && ui.confirm === `ask:${row.id}` ? row.use.ask : null}
			<div data-row-id={row.id}>
				<Row
					id="{uid}-{row.id}"
					name={row.name}
					img={row.img}
					tag={row.tag}
					tagOn={row.tagOn}
					summary={row.summary}
					cost={{ text: row.lasts }}
					description={row.description}
					facts={row.facts}
					state={row.state}
					open={ui.openRows.includes(row.id)}
					ontoggle={() => toggleRow(ui, row.id)}
					onuse={row.use ? () => use(row) : undefined}
					useLabel={row.use?.kind === 'ask' ? row.use.ask.label : row.use?.label}
					useExpanded={row.use?.kind === 'ask' ? !!asking : undefined}
					onedit={row.edit ? () => row.edit && perform(row.edit) : undefined}
					hasWindow={!!row.edit}
				>
					{#if asking}
						<div class="ask">
							<ConfirmBar
								question={asking.question}
								confirmLabel={asking.confirmLabel}
								onconfirm={() => confirm(row)}
								oncancel={() => closeConfirm(ui)}
							/>
						</div>
					{/if}
				</Row>
			</div>
		{/each}
	</section>
{/each}
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
	.group {
		margin-bottom: 8px;
	}
	.empty {
		margin: 0 4px 4px;
		font-size: 0.813rem;
		color: var(--nimble-ui-ink-muted);
	}
	.ask {
		padding: 4px 8px 8px 34px;
	}
</style>
