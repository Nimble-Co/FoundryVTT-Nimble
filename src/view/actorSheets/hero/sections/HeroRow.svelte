<!--
@component
One row of the Actions or Spells tab, from a `HeroRowView`, on the `Row` part.
A click acts at once, opens the choice step, or does nothing (the row is off and says why).
The choice step shows under the row while `ui.choiceStep` is the row id: a click opens it, and `reveal()` opens it after a use.
A row that asks first (Remove an effect) shows a ConfirmBar under it.
In edit mode the row does not act: its numbers are fields, an object gets a "Store in" select, and the trash button
asks in a ConfirmBar before Delete. A stored object is indented under its container.
You can drag the row out of the sheet (on a touch screen only in edit mode).
-->
<script lang="ts">
	import type { HeroRowProps } from '#types/components/actorSheets/HeroRow.d.ts';
	import ConfirmBar from '../../parts/ConfirmBar.svelte';
	import InlineNumber from '../../parts/InlineNumber.svelte';
	import Row from '../../parts/Row.svelte';
	import { dragDataOf, mayDrag } from '../../shared/drag.ts';
	import {
		askConfirm,
		closeChoice,
		closeConfirm,
		toggleChoice,
		toggleRow,
	} from '../../shared/sheetUiState.ts';
	import HeroRowChoice from './HeroRowChoice.svelte';

	let { row, ui, perform }: HeroRowProps = $props();

	const uid = $props.id();
	let pointerType: string | null = null;

	const editing = $derived(ui.editing);
	const use = $derived(row.use);
	const stepOpen = $derived(!editing && !!row.choice && ui.choiceStep === row.id);
	const askId = $derived(`ask:${row.id}`);
	const removeId = $derived(`remove:${row.id}`);
	const asking = $derived.by(() => {
		if (!editing && use?.kind === 'ask' && ui.confirm === askId) return use.ask;
		if (editing && row.remove && ui.confirm === removeId) return row.remove;
		return null;
	});
	const hasFields = $derived(row.fields.length > 0 || !!row.storeIn || !!row.remove);
	const useLabel = $derived(use?.kind === 'ask' ? use.ask.label : use?.label);

	function onuse() {
		if (!use) return;
		if (use.kind === 'act') void perform(use.intent);
		else if (use.kind === 'choose') toggleChoice(ui, row.id);
		else if (use.kind === 'ask') askConfirm(ui, askId);
	}

	function confirm() {
		const intent = asking?.intent;
		closeConfirm(ui);
		if (intent) void perform(intent);
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
	{#if row.storeIn}
		{@const storeIn = row.storeIn}
		<select
			class="store"
			aria-label={storeIn.label}
			value={storeIn.value}
			onchange={(event) =>
				perform({
					kind: 'storeIn',
					itemId: storeIn.itemId,
					containerId: event.currentTarget.value,
				})}
		>
			{#each storeIn.options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{/if}
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
	{#if row.remove}
		<button
			type="button"
			class="nimble-u-reset-button trash"
			aria-label={row.remove.label}
			data-tooltip={row.remove.label}
			onclick={() => askConfirm(ui, removeId)}
		>
			<i class="fa-solid fa-trash"></i>
		</button>
	{/if}
{/snippet}

<div
	class="hero-row"
	class:indent={row.indent}
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
		onequip={row.equip ? () => row.equip && perform(row.equip.intent) : undefined}
		equipped={row.equip?.on}
		summary={row.summary}
		summaryTone={row.summaryTone}
		cost={row.cost}
		description={row.description}
		facts={row.facts}
		state={row.state}
		open={ui.openRows.includes(row.id)}
		ontoggle={() => toggleRow(ui, row.id)}
		onuse={!editing && use ? onuse : undefined}
		{useLabel}
		useExpanded={use?.kind === 'choose' ? stepOpen : use?.kind === 'ask' ? !!asking : undefined}
		disabled={use?.kind === 'blocked' || undefined}
		onedit={row.edit ? () => row.edit && perform(row.edit) : undefined}
		hasWindow={!!row.edit}
		fields={editing && hasFields ? fields : undefined}
		dim={editing && !hasFields && !row.edit}
	>
		{#if stepOpen && row.choice}
			<HeroRowChoice step={row.choice} {perform} onclose={() => closeChoice(ui)} />
		{/if}
		{#if asking}
			<div class="ask">
				<ConfirmBar
					question={asking.question}
					confirmLabel={asking.confirmLabel}
					onconfirm={confirm}
					oncancel={() => closeConfirm(ui)}
				/>
			</div>
		{/if}
	</Row>
</div>

<style>
	.hero-row {
		border-radius: 4px;
	}
	.indent {
		margin-left: 24px;
	}
	.ask {
		padding: 4px 8px 8px 34px;
	}
	.store {
		max-width: 120px;
		height: 24px;
		padding: 0 4px;
		border: 1px dashed var(--nimble-ui-edge);
		border-radius: 4px;
		background: transparent;
		font: 600 0.857rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.store:hover,
	.store:focus-visible {
		border-style: solid;
		border-color: var(--nimble-ui-own);
		outline: none;
	}
	.trash {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		font-size: 0.786rem;
		color: var(--nimble-ui-ink-muted);
	}
	.trash:hover,
	.trash:focus-visible {
		color: var(--nimble-roll-failure-color);
		background: var(--nimble-ui-own-background);
		outline: none;
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
