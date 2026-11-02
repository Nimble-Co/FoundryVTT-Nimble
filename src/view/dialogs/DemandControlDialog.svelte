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
	const state = untrack(() => createDemandControlState({ actor, locked, reportsRound }));

	const others = $derived(state.creatures.filter((each) => each.uuid !== state.creatureUuid));

	function onConfirm() {
		if (state.canConfirm) dialog.submitActivation($state.snapshot(state.choice));
	}
</script>

<RollWindow
	title={localize(`${TEXT}.title`)}
	icon="fa-solid fa-hand"
	rollIcon="fa-solid fa-check"
	rollLabel={localize(state.option === 'iInsist' ? `${TEXT}.confirmCast` : `${TEXT}.confirm`)}
	oncancel={() => dialog.close()}
	onroll={onConfirm}
>
	{#if state.roundUsed}<p class="note">{localize(`${TEXT}.usedThisRound`)}</p>{/if}

	<div class="rows">
		{#each state.rows as row (row.id)}
			<button
				type="button"
				class="row"
				class:row--selected={state.option === row.id}
				class:row--chosen={row.chosen}
				aria-pressed={state.option === row.id}
				onclick={() => (state.option = row.id)}
			>
				<span>
					<b>{row.label}</b>
					<small>{row.text}</small>
				</span>
				{#if row.chosen}<em>{localize(`${TEXT}.chosen`)}</em>{/if}
			</button>
		{/each}
	</div>

	{#if state.option === 'iInsist'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.cantrip`)}</span>
			<select bind:value={state.cantripId} aria-label={localize(`${TEXT}.cantrip`)}>
				{#each state.cantrips as cantrip (cantrip.id)}
					<option value={cantrip.id}>{cantrip.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if state.option === 'elementalAffliction' || state.option === 'no'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.creature`)}</span>
			<select bind:value={state.creatureUuid} aria-label={localize(`${TEXT}.creature`)}>
				<option value={null}></option>
				{#each state.creatures as creature (creature.uuid)}
					<option value={creature.uuid}>{creature.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if state.option === 'elementalAffliction'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.condition`)}</span>
			<select bind:value={state.condition} aria-label={localize(`${TEXT}.condition`)}>
				{#each state.afflictions as condition (condition)}
					<option value={condition}>{localize(`NIMBLE.conditions.${condition}`)}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if state.option === 'no'}
		<div class="fld">
			<span class="lb">{localize(`${TEXT}.protected`)}</span>
			<select bind:value={state.protectedUuid} aria-label={localize(`${TEXT}.protected`)}>
				<option value={null}></option>
				{#each others as creature (creature.uuid)}
					<option value={creature.uuid}>{creature.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if state.offersTwice}
		<label class="check">
			<input type="checkbox" bind:checked={state.twice} />
			<span>{localize(`${TEXT}.twice`)}</span>
		</label>
	{/if}
	{#if state.offersReaction}
		<label class="check">
			<input type="checkbox" bind:checked={state.asReaction} />
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
