<!--
@component
The turn economy in combat: the actions left as a number and as cells, an extra action, what the next turn gains or loses,
and End turn. A cell click spends or restores one action. End turn with actions left asks first, in the box.
When it is not your turn the box is quiet and says what a reaction costs. `compact` is the one-line form of the narrow header.
-->
<script lang="ts">
	import ConfirmBar from '../../parts/ConfirmBar.svelte';
	import type { SheetUiState } from '../../shared/sheetUiState.ts';
	import type { HeroPerform } from '../heroIntent.ts';
	import type { HeroTurnView } from '../heroRail.ts';
	import localize from '#utils/localize.js';

	interface Props {
		turn: HeroTurnView;
		ui: SheetUiState;
		perform: HeroPerform;
		compact?: boolean;
	}

	let { turn, ui, perform, compact = false }: Props = $props();

	const TURN = 'NIMBLE.actorSheet.hero.turn';

	function endTurn() {
		if (!turn.endTurn) return;
		if (turn.endTurn.question) ui.confirm = 'endTurn';
		else void perform(turn.endTurn.intent);
	}
</script>

<div
	class="box"
	class:off={!turn.isTurn}
	class:compact
	role="group"
	aria-label={localize(`${TURN}.label`)}
>
	<div class="heading"><b>{turn.heading}</b></div>
	<div class="line">
		<span class="now">{turn.current}<span>/{turn.max}</span></span>
		<div class="cells">
			{#each turn.cells as cell, index (index)}
				<button
					type="button"
					class="nimble-u-reset-button cell"
					class:available={cell.available}
					aria-label={cell.label}
					data-tooltip={cell.label}
					disabled={ui.editing}
					onclick={() => perform(cell.intent)}
				></button>
			{/each}
			{#if turn.addAction}
				{@const addAction = turn.addAction}
				<button
					type="button"
					class="nimble-u-reset-button cell add"
					aria-label={localize('NIMBLE.ui.heroicActions.addAdditionalAction')}
					data-tooltip={localize('NIMBLE.ui.heroicActions.addAdditionalAction')}
					disabled={ui.editing}
					onclick={() => perform(addAction)}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			{/if}
		</div>
		{#if compact && turn.endTurn && ui.confirm !== 'endTurn'}
			<button
				type="button"
				class="nimble-u-reset-button end"
				disabled={ui.editing}
				onclick={endTurn}
			>
				{localize('NIMBLE.ui.heroicActions.endTurn')}
			</button>
		{/if}
	</div>
	{#if turn.pending}<p class="pending">{turn.pending}</p>{/if}
	{#if turn.hint && !compact}<p class="hint">{turn.hint}</p>{/if}
	{#if turn.endTurn}
		{@const end = turn.endTurn}
		{#if ui.confirm === 'endTurn' && end.question}
			<ConfirmBar
				question={end.question}
				confirmLabel={localize('NIMBLE.ui.heroicActions.endTurn')}
				cancelLabel={localize(`${TURN}.keepPlaying`)}
				onconfirm={() => {
					ui.confirm = null;
					void perform(end.intent);
				}}
				oncancel={() => (ui.confirm = null)}
			/>
		{:else if !compact}
			<button
				type="button"
				class="nimble-u-reset-button end"
				disabled={ui.editing}
				onclick={endTurn}
			>
				{localize('NIMBLE.ui.heroicActions.endTurn')}<i class="fa-solid fa-forward-step"></i>
			</button>
		{/if}
	{/if}
</div>

<style>
	.box {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 9px 10px 10px;
		border: 1px solid color-mix(in srgb, var(--nimble-ui-action) 60%, transparent);
		border-radius: 5px;
		background: var(--nimble-ui-action-background);
	}
	.box.off {
		border-color: var(--nimble-ui-line);
		background: var(--nimble-ui-well);
	}
	.box.compact {
		gap: 6px;
		padding: 6px 8px;
	}
	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.heading b {
		font-size: 0.857rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--nimble-ui-action);
	}
	.off .heading b {
		color: var(--nimble-ui-ink);
	}
	.pending {
		margin: 0;
		font-size: 0.857rem;
		font-weight: 700;
		line-height: 1.3;
		color: var(--nimble-ui-warn);
	}
	.line {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.now {
		flex: none;
		font-size: 2.43rem;
		font-weight: 900;
		line-height: 0.9;
		color: var(--nimble-ui-action);
	}
	.compact .now {
		font-size: 1.714rem;
	}
	.now > span {
		font-size: 1rem;
		color: var(--nimble-ui-ink-muted);
	}
	.cells {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: 3px;
	}
	.cell {
		flex: 1;
		min-width: 0;
		height: 24px;
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nimble-ui-action) 70%, transparent);
	}
	.cell.available {
		background: var(--nimble-ui-action-cell);
		box-shadow: inset 0 0 0 1px var(--nimble-ui-action-cell-edge);
	}
	.cell.add {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		border: 1px dashed var(--nimble-ui-ring);
		box-shadow: none;
		font-size: 0.643rem;
		color: var(--nimble-ui-ink-muted);
	}
	.cell:hover {
		outline: 1px solid var(--nimble-ui-highlight);
		outline-offset: 1px;
	}
	.hint {
		margin: 0;
		font-size: 0.857rem;
		font-weight: 500;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
	}
	.end {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		height: 30px;
		padding: 0 10px;
		border-radius: 4px;
		background: var(--nimble-ui-end-turn);
		font-size: 0.893rem;
		font-weight: 700;
		color: var(--nimble-ui-fill-ink);
	}
	.end:hover {
		filter: brightness(1.12);
	}
	.end i {
		font-size: 0.714rem;
	}
	button:disabled {
		opacity: 0.4;
		filter: saturate(0.35);
		pointer-events: none;
	}
</style>
