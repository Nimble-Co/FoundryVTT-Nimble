<!--
@component
The right side of a row: the uses left with when they come back, the pool cost (mana, dice), Free for a free use,
and one green bar for each action. An outlined bar is an action that is spent this turn.
NPC cards use the same part for the range and the uses, with `compact`: tighter spacing and smaller uses.
The pool kind picks the colour of the pool cost.
-->
<script lang="ts">
	import localize from '#utils/localize.js';
	import type { RowCostProps, RowUses } from './types.ts';

	let {
		text,
		uses = [],
		pool,
		free = false,
		range,
		actions = 0,
		actionsSpent = 0,
		compact = false,
		outTone = 'vital',
		hints = false,
	}: RowCostProps = $props();

	const bars = $derived(Array.from({ length: actions }, (_, i) => i >= actions - actionsSpent));

	const usesHint = (u: RowUses) =>
		hints
			? localize(
					u.per
						? 'NIMBLE.actorSheet.parts.rowCost.usesBack'
						: 'NIMBLE.actorSheet.parts.rowCost.usesLeft',
					{ left: String(u.left), max: String(u.max), per: u.per ?? '' },
				)
			: undefined;
	const actionsHint = $derived(
		hints
			? localize(
					actions === 1
						? 'NIMBLE.actorSheet.parts.rowCost.action'
						: 'NIMBLE.actorSheet.parts.rowCost.actions',
					{ count: String(actions) },
				)
			: undefined,
	);
</script>

<span class="cost" class:compact>
	{#if text}<span class="tx">{text}</span>{/if}
	{#each uses as u}
		<span class="us {outTone}" class:out={u.left < (u.need ?? 1)} data-tooltip={usesHint(u)}>
			{u.left}/{u.max}<small>{u.per}</small>
		</span>
	{/each}
	{#if pool}
		<span class="pool {pool.kind}" class:muted={pool.muted}
			><i class={pool.icon}></i>{pool.amount}</span
		>
	{/if}
	{#if free}<span class="free">{localize('NIMBLE.actorSheet.parts.rowCost.free')}</span>{/if}
	{#if range}<span class="rng">{range}</span>{/if}
	{#if actions > 0}
		<span class="ap" data-tooltip={actionsHint}>
			{#each bars as spent}<i class:spent></i>{/each}
		</span>
	{/if}
</span>

<style>
	.cost {
		display: flex;
		align-items: center;
		gap: 11px;
		white-space: nowrap;
	}
	.compact {
		gap: 6px;
	}
	.tx {
		font: 700 0.857rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink-muted);
	}
	.us {
		display: flex;
		align-items: baseline;
		font: 700 0.893rem/1 var(--nimble-primary-font);
		font-variant-numeric: tabular-nums;
		color: var(--nimble-ui-ink);
	}
	.us small {
		margin-left: 3px;
		font-size: 0.786rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.us.out {
		color: var(--nimble-ui-vital);
	}
	.us.muted.out {
		color: var(--nimble-ui-ink-muted);
	}
	.us.ink.out {
		color: var(--nimble-ui-ink);
	}
	.compact .us {
		margin: 0 3px;
		font-size: 0.857rem;
		line-height: 1.25;
	}
	.pool {
		--tone: var(--nimble-class-resource-color);
		display: flex;
		align-items: center;
		gap: 4px;
		font: 800 0.929rem/1 var(--nimble-primary-font);
		color: color-mix(in srgb, var(--tone) var(--nimble-ui-tone-mix), #000);
	}
	.mana {
		--tone: var(--nimble-pool-mana-color);
	}
	.dice {
		--tone: var(--nimble-pool-dice-color);
	}
	.charges {
		--tone: var(--nimble-pool-charges-color);
	}
	.uses {
		--tone: var(--nimble-pool-uses-color);
	}
	.pool.count {
		color: var(--tone);
	}
	.pool.muted {
		color: var(--nimble-ui-ink-muted);
	}
	.pool i {
		font-size: 0.857rem;
	}
	.free {
		font: 800 0.786rem/1 var(--nimble-primary-font);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--nimble-ui-action);
	}
	.rng {
		padding: 0 5px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 3px;
		font: 600 0.786rem/18px var(--nimble-primary-font);
		color: var(--nimble-ui-ink-muted);
	}
	.compact .rng {
		margin: 0 2px;
	}
	.ap {
		display: flex;
		gap: 3px;
	}
	.ap i {
		width: 7px;
		height: 15px;
		border-radius: 2px;
		background: var(--nimble-ui-action);
	}
	.ap i.spent {
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--nimble-ui-action);
	}
</style>
