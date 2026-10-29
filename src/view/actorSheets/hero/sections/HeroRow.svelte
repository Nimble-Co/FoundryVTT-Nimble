<!--
@component
One row of the Actions or Spells tab, from a `HeroRowView`, on the `Row` part.
A click acts at once, opens the choice step, or does nothing (the row is off and says why).
The choice step shows under the row while `ui.choiceStep` is the row id: a click opens it, and `reveal()` opens it after a use.
In edit mode the row does not act: the numbers of its pools are fields. You can drag the row out of the sheet
(on a touch screen only in edit mode).
-->
<script lang="ts">
	import type { HeroRowProps } from '#types/components/actorSheets/HeroRow.d.ts';
	import InlineNumber from '../../parts/InlineNumber.svelte';
	import Row from '../../parts/Row.svelte';
	import { dragDataOf, mayDrag } from '../../shared/drag.ts';
	import { closeChoice, toggleChoice, toggleRow } from '../../shared/sheetUiState.ts';
	import HeroRowChoice from './HeroRowChoice.svelte';

	let { row, ui, perform }: HeroRowProps = $props();

	const uid = $props.id();
	let pointerType: string | null = null;

	const editing = $derived(ui.editing);
	const use = $derived(row.use);
	const stepOpen = $derived(!editing && !!row.choice && ui.choiceStep === row.id);

	function onuse() {
		if (!use) return;
		if (use.kind === 'act') void perform(use.intent);
		else if (use.kind === 'choose') toggleChoice(ui, row.id);
	}

	function ondragstart(event: DragEvent) {
		if (!row.drag || !mayDrag(pointerType, editing)) {
			event.preventDefault();
			return;
		}
		event.dataTransfer?.setData('text/plain', JSON.stringify(dragDataOf(row.drag)));
	}
</script>

{#snippet fields()}
	{#each row.fields as field (field.kind === 'uses' ? field.poolId : 'quantity')}
		<span class="us">
			{#if field.kind === 'quantity'}
				<span class="mx">x</span><InlineNumber
					value={field.value}
					label={field.label}
					min={0}
					dotted
					width="22px"
					variant="cost"
					onchange={(value) => perform({ kind: 'setQuantity', itemId: field.itemId, value })}
				/>
			{:else}
				<InlineNumber
					value={field.value}
					label={field.label}
					min={0}
					max={field.max}
					dotted
					width="22px"
					variant="cost"
					onchange={(value) => perform({ kind: 'setPoolCharges', poolId: field.poolId, value })}
				/><span class="mx">/{field.max}</span>{#if field.per}<small>{field.per}</small>{/if}
			{/if}
		</span>
	{/each}
{/snippet}

<div
	class="hero-row"
	data-row-id={row.id}
	draggable={row.drag ? 'true' : undefined}
	role="presentation"
	onpointerdown={(event) => (pointerType = event.pointerType)}
	{ondragstart}
>
	<Row
		id="{uid}-row"
		name={row.name}
		img={row.img}
		icon={row.icon}
		tag={row.tag}
		tagOn={row.tagOn}
		summary={row.summary}
		cost={row.cost}
		description={row.description}
		facts={row.facts}
		state={row.state}
		open={ui.openRows.includes(row.id)}
		ontoggle={() => toggleRow(ui, row.id)}
		onuse={!editing && use ? onuse : undefined}
		useLabel={use?.label}
		useExpanded={use?.kind === 'choose' ? stepOpen : undefined}
		disabled={use?.kind === 'blocked' || undefined}
		onedit={row.edit ? () => row.edit && perform(row.edit) : undefined}
		hasWindow={!!row.edit}
		fields={editing && row.fields.length ? fields : undefined}
		dim={editing && !row.fields.length && !row.edit}
	>
		{#if stepOpen && row.choice}
			<HeroRowChoice step={row.choice} {perform} onclose={() => closeChoice(ui)} />
		{/if}
	</Row>
</div>

<style>
	.hero-row {
		border-radius: 4px;
	}
	.us {
		display: flex;
		align-items: baseline;
		font: 700 0.893rem/1 var(--nimble-primary-font);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--nimble-ui-ink);
	}
	.mx {
		color: var(--nimble-ui-ink-muted);
	}
	.us small {
		margin-left: 3px;
		font-size: 0.786rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
</style>
