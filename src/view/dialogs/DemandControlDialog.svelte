<!--
@component
Demand Control: the options of the Control Table, with what each option asks for.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import localize from '#utils/localize.js';
	import { createDemandControlState } from './demandControlDialogState.svelte.ts';
	import RollWindow from './components/RollWindow.svelte';

	let { actor, dialog, locked, reportsRound } = $props();

	const TEXT = 'NIMBLE.demandControl';
	const control = untrack(() => createDemandControlState({ actor, locked, reportsRound }));

	const others = $derived(control.creatures.filter((each) => each.uuid !== control.creatureUuid));

	function onConfirm() {
		if (control.canConfirm) dialog.submitActivation($state.snapshot(control.choice));
	}
</script>

<RollWindow
	title={localize(`${TEXT}.title`)}
	icon="fa-solid fa-hand"
	rollIcon="fa-solid fa-check"
	rollLabel={localize(control.option === 'iInsist' ? `${TEXT}.confirmCast` : `${TEXT}.confirm`)}
	oncancel={() => dialog.close()}
	onroll={onConfirm}
>
	{#if control.roundUsed}<p class="note">{localize(`${TEXT}.usedThisRound`)}</p>{/if}

	<div class="rows">
		{#each control.rows as row (row.id)}
			<button
				type="button"
				class="row"
				class:row--selected={control.option === row.id}
				class:row--chosen={row.chosen}
				aria-pressed={control.option === row.id}
				onclick={() => (control.option = row.id)}
			>
				<span>
					<b>{row.label}</b>
					<small>{row.text}</small>
				</span>
				{#if row.chosen}<em>{localize(`${TEXT}.chosen`)}</em>{/if}
			</button>
		{/each}
	</div>

	{#if control.option === 'iInsist'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.cantrip`)}</span>
			<select bind:value={control.cantripId} aria-label={localize(`${TEXT}.cantrip`)}>
				{#each control.cantrips as cantrip (cantrip.id)}
					<option value={cantrip.id}>{cantrip.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if control.option === 'elementalAffliction' || control.option === 'no'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.creature`)}</span>
			<select bind:value={control.creatureUuid} aria-label={localize(`${TEXT}.creature`)}>
				<option value={null}></option>
				{#each control.creatures as creature (creature.uuid)}
					<option value={creature.uuid}>{creature.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if control.option === 'elementalAffliction'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.condition`)}</span>
			<select bind:value={control.condition} aria-label={localize(`${TEXT}.condition`)}>
				{#each control.afflictions as condition (condition)}
					<option value={condition}>{localize(`NIMBLE.conditions.${condition}`)}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if control.option === 'no'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.protected`)}</span>
			<select bind:value={control.protectedUuid} aria-label={localize(`${TEXT}.protected`)}>
				<option value={null}></option>
				{#each others as creature (creature.uuid)}
					<option value={creature.uuid}>{creature.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if control.offersTwice}
		<label class="check">
			<input type="checkbox" bind:checked={control.twice} />
			<span>{localize(`${TEXT}.twice`)}</span>
		</label>
	{/if}
	{#if control.offersReaction}
		<label class="check">
			<input type="checkbox" bind:checked={control.asReaction} />
			<span>{localize(`${TEXT}.asReaction`)}</span>
		</label>
	{/if}
</RollWindow>

<style lang="scss">
	.note {
		margin: 0;
		font-size: 0.781rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		height: auto;
		padding: 6px 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		background: none;
		text-align: start;
		font-size: 0.812rem;
		line-height: 1.25;
		color: var(--nimble-ui-ink);

		&:hover {
			border-color: var(--nimble-ui-highlight);
		}

		&--selected {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-soft);
		}

		&--chosen {
			opacity: 0.6;
		}

		small {
			display: block;
			font-size: 0.75rem;
			font-weight: 500;
			color: var(--nimble-ui-ink-muted);
		}

		em {
			flex: none;
			font-size: 0.75rem;
			font-style: normal;
			color: var(--nimble-ui-ink-muted);
		}
	}
</style>
