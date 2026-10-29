<!--
@component
One row of the Actions or Spells tab, from a `HeroRowView`, on the `Row` part.
A click acts at once, opens the choice step, or does nothing (the row is off and says why).
The choice step shows under the row while `ui.choiceStep` is the row id: a click opens it, and `reveal()` opens it after a use.
A row that asks first (Remove an effect) shows a ConfirmBar under it.
In edit mode the row does not act: its numbers are fields, an object gets a "Store in" select, and the trash button
asks in a ConfirmBar before Delete. A stored object is indented under its container.
You can drag the row out of the sheet (on a touch screen only in edit mode).
An Inventory row takes an Item drop: a container row stores it, a stored row puts it in the same container,
and a loose row leaves it loose. The container shows a ring while you drag over it.
-->
<script lang="ts">
	import type { HeroRowProps } from '#types/components/actorSheets/HeroRow.d.ts';
	import ConfirmBar from '../../parts/ConfirmBar.svelte';
	import InlineNumber from '../../parts/InlineNumber.svelte';
	import Row from '../../parts/Row.svelte';
	import { closeChoice, closeConfirm, toggleRow } from '../../shared/sheetUiState.ts';
	import { heroRowControls } from './HeroRow.svelte.ts';
	import HeroRowChoice from './HeroRowChoice.svelte';

	let { row, ui, perform }: HeroRowProps = $props();

	const uid = $props.id();
	const c = heroRowControls(() => ({ row, ui, perform }));
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
			onclick={c.askRemove}
		>
			<i class="fa-solid fa-trash"></i>
		</button>
	{/if}
{/snippet}

<div
	class="hero-row"
	class:indent={row.indent}
	class:drop-over={c.dropOver}
	data-row-id={row.id}
	draggable={row.drag ? 'true' : undefined}
	role="presentation"
	onpointerdown={c.onpointerdown}
	ondragstart={c.ondragstart}
	ondragenter={c.ondragenter}
	ondragleave={c.ondragleave}
	ondragend={c.ondragend}
	ondrop={c.ondrop}
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
		descriptionHtml={row.descriptionHtml}
		facts={row.facts}
		state={row.state}
		open={ui.openRows.includes(row.id)}
		ontoggle={() => toggleRow(ui, row.id)}
		onuse={!c.editing && row.use ? c.onuse : undefined}
		useLabel={c.useLabel}
		useExpanded={c.useExpanded}
		disabled={row.use?.kind === 'blocked' || undefined}
		onedit={row.edit ? () => row.edit && perform(row.edit) : undefined}
		hasWindow={!!row.edit}
		fields={c.editing && c.hasFields ? fields : undefined}
		dim={c.editing && !c.hasFields && !row.edit}
	>
		{#if c.stepOpen && row.choice}
			<HeroRowChoice step={row.choice} {perform} onclose={() => closeChoice(ui)} />
		{/if}
		{#if c.asking}
			<div class="ask">
				<ConfirmBar
					question={c.asking.question}
					confirmLabel={c.asking.confirmLabel}
					onconfirm={c.confirm}
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
	.drop-over {
		box-shadow: inset 0 0 0 2px var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
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
