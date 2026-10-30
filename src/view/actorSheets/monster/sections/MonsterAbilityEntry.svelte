<!--
@component
One entry of the Abilities tab: a card, the note of an attack sequence, or a heading line.
In edit mode a card does not act, its uses are numbers that you type, and each entry has a trash button
that asks in a ConfirmBar before Delete. A heading line gets its pen in edit mode.
-->
<script lang="ts">
	import type { MonsterAbilityEntryProps } from '#types/components/actorSheets/MonsterAbilityEntry.d.ts';
	import AbilityCard from '../../parts/AbilityCard.svelte';
	import AttackSequence from '../../parts/AttackSequence.svelte';
	import ConfirmBar from '../../parts/ConfirmBar.svelte';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import InlineNumber from '../../parts/InlineNumber.svelte';
	import RowButton from '../../parts/RowButton.svelte';
	import { askConfirm, closeConfirm, toggleClosedRow } from '../../shared/sheetUiState.ts';

	let { entry, ui, perform, uid }: MonsterAbilityEntryProps = $props();

	const editing = $derived(ui.editing);
	const confirmId = $derived(`delete:${entry.id}`);
	const asking = $derived(
		editing && entry.remove && ui.confirm === confirmId ? entry.remove : null,
	);

	function confirm() {
		const intent = asking?.intent;
		closeConfirm(ui);
		if (intent) void perform(intent);
	}
</script>

{#snippet trash()}
	{#if entry.remove}
		<button
			type="button"
			class="nimble-u-reset-button trash"
			aria-label={entry.remove.label}
			data-tooltip={entry.remove.label}
			onclick={() => askConfirm(ui, confirmId)}
		>
			<i class="fa-solid fa-trash"></i>
		</button>
	{/if}
{/snippet}

{#snippet cardFields()}
	{#if entry.kind === 'card'}
		{#each entry.fields as field (field.poolId)}
			<span class="us">
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
			</span>
		{/each}
	{/if}
	{@render trash()}
{/snippet}

{#snippet ask()}
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
{/snippet}

{#if entry.kind === 'card'}
	<AbilityCard
		id="{uid}-{entry.id}"
		name={entry.name}
		img={entry.img}
		kind={entry.roll ? 'roll' : 'chat'}
		range={entry.range}
		uses={entry.uses}
		description={entry.description}
		descriptionHtml={entry.descriptionHtml}
		nested={entry.nested}
		bind:open={() => !ui.closedRows.includes(entry.id), () => toggleClosedRow(ui, entry.id)}
		onuse={editing ? undefined : () => perform(entry.use.intent)}
		onedit={() => perform(entry.edit.intent)}
		fields={editing ? cardFields : undefined}
		children={ask}
	/>
{:else if entry.kind === 'sequence'}
	<AttackSequence
		parts={entry.html === undefined ? [entry.text] : []}
		html={entry.html}
		name={entry.name}
		onedit={() => perform(entry.edit.intent)}
		fields={editing ? trash : undefined}
		children={ask}
	/>
{:else}
	<GroupHeading label={entry.name} plain>
		{#if editing}
			{@render trash()}
			<RowButton
				kind="edit"
				size="sm"
				name={entry.name}
				onclick={() => perform(entry.edit.intent)}
			/>
		{/if}
	</GroupHeading>
	{@render ask()}
{/if}

<style>
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
		font: 700 0.857rem/1 var(--nimble-primary-font);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--nimble-ui-ink);
	}
	.mx {
		color: var(--nimble-ui-ink-muted);
	}
	.us small {
		margin-left: 3px;
		font-size: 0.714rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.ask {
		padding: 0 6px 6px;
	}
</style>
