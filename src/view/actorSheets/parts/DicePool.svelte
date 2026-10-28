<!--
@component
A pool of rolled dice that abilities spend. Each die shows its face; empty slots show how many more you can have.
Minus removes the last die and plus rolls one more. Only a pool of rolled dice has minus and plus: a pool with a number (mana) is an `InlineNumber`.
The pool kind picks the colour. It sits on the dark rail (`nimble-chrome`).

`variant="rail"` is the pool on the character sheet rail: the label line of the other rail meters, a small note after the label (`sub`),
and 24 px steppers. A pool that you get when you roll Initiative is `idle` out of combat:
dashed slots and steppers that do nothing. `rest` is edit mode: the steppers fade and ignore the pointer.
-->
<script lang="ts">
	import localize from '#utils/localize.js';
	import type { PoolKind } from './types.ts';

	interface Props {
		label: string;
		/** Font Awesome class */
		icon?: string;
		kind?: PoolKind;
		die?: number;
		/** the face of each die in the pool */
		faces?: number[];
		max?: number;
		onremove?: () => void;
		onadd?: () => void;
		/** card (default) or rail (character sheet rail) */
		variant?: 'card' | 'rail';
		/** rail: the note after the label; default "d{die}" */
		sub?: string;
		/** you get the dice when you roll Initiative: the pool does nothing until then */
		idle?: boolean;
		/** edit mode: the steppers fade and ignore the pointer */
		rest?: boolean;
		tooltip?: string;
	}

	let {
		label,
		icon,
		kind = 'dice',
		die = 6,
		faces = [],
		max = 3,
		onremove,
		onadd,
		variant = 'card',
		sub,
		idle = false,
		rest = false,
		tooltip,
	}: Props = $props();

	const slots = $derived(Array.from({ length: max }, (_, i) => faces[i]));
	const rail = $derived(variant === 'rail');
	// the rail variant follows the other rail meters: the steppers stop only while the pool is idle
	const noRemove = $derived(rail ? idle : faces.length === 0);
	const noAdd = $derived(rail ? idle : faces.length >= max);
	const dieText = $derived(localize('NIMBLE.actorSheet.parts.dicePool.die', { die: String(die) }));
	const facesText = $derived(
		localize('NIMBLE.actorSheet.parts.dicePool.faces', {
			label,
			faces: faces.length ? faces.join(', ') : localize('NIMBLE.actorSheet.parts.dicePool.none'),
		}),
	);
</script>

<div class="pool {kind}" class:rail class:idle class:rest data-tooltip={tooltip}>
	{#if rail}
		<div class="hd">
			<span class="lb">
				{#if icon}<i class={icon}></i>{/if}
				{label} <small>{sub ?? dieText}</small>
			</span>
			<b class="count">{faces.length}/{max}</b>
		</div>
	{:else}
		<div class="hd">
			{#if icon}<i class={icon}></i>{/if}{label}
			{dieText}<b>{faces.length}/{max}</b>
		</div>
	{/if}
	<div class="cells">
		<button
			type="button"
			class="nimble-u-reset-button stp"
			aria-disabled={noRemove || undefined}
			aria-label={localize('NIMBLE.actorSheet.parts.dicePool.removeLabel', { label })}
			data-tooltip={localize('NIMBLE.actorSheet.parts.dicePool.remove')}
			onclick={noRemove ? undefined : onremove}
		>
			<i class="fa-solid fa-minus"></i>
		</button>
		<div class="faces" role="group" aria-label={facesText}>
			{#each slots as f}
				{#if f === undefined}<span class="die empty" aria-hidden="true"></span>{:else}<span
						class="die">{f}</span
					>{/if}
			{/each}
		</div>
		<button
			type="button"
			class="nimble-u-reset-button stp"
			aria-disabled={noAdd || undefined}
			aria-label={localize('NIMBLE.actorSheet.parts.dicePool.addLabel', { label })}
			data-tooltip={localize('NIMBLE.actorSheet.parts.dicePool.add')}
			onclick={noAdd ? undefined : onadd}
		>
			<i class="fa-solid fa-plus"></i>
		</button>
	</div>
</div>

<style>
	.pool {
		--tone: var(--nimble-class-resource-color);
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--nimble-primary-font);
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
	.hd {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.833rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: var(--nimble-ui-ink-dim);
	}
	.hd i {
		color: var(--tone);
	}
	.hd b {
		margin-left: auto;
		font-size: 0.893rem;
		letter-spacing: 0;
		color: var(--nimble-ui-ink);
	}
	.cells {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.faces {
		flex: 1;
		display: flex;
		gap: 3px;
	}
	.die {
		flex: 1;
		min-width: 0;
		max-width: 34px;
		height: 24px;
		display: grid;
		place-items: center;
		border-radius: 4px;
		background: var(--tone);
		font-size: 0.929rem;
		font-weight: 900;
		line-height: 1;
		color: #181821;
	}
	.die.empty {
		background: transparent;
		border: 1px solid var(--nimble-ui-ring);
	}
	.stp {
		display: grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.714rem;
		color: var(--nimble-ui-ink);
	}
	.stp:hover {
		border-color: var(--nimble-ui-highlight);
	}
	.stp[aria-disabled='true'] {
		opacity: 0.4;
		cursor: default;
	}
	.rest .stp {
		opacity: 0.4;
		filter: saturate(0.35);
		pointer-events: none;
	}
	.rail {
		gap: 4px;
	}
	.rail .hd {
		align-items: baseline;
		justify-content: space-between;
		line-height: 1.15;
	}
	.rail .lb {
		min-width: 0;
	}
	.rail .hd small {
		font-size: 0.833rem;
		font-weight: 600;
		letter-spacing: 0;
		color: var(--nimble-ui-ink-muted);
	}
	.rail .hd .count {
		margin-left: 0;
		font-size: 0.833rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: color-mix(in srgb, var(--tone) 65%, #fff);
	}
	.rail .cells {
		gap: 4px;
	}
	.rail .faces {
		height: 24px;
	}
	.rail .stp {
		width: 24px;
		height: 24px;
	}
	.rail .stp[aria-disabled='true'] {
		opacity: 1;
		border-style: dashed;
		color: var(--nimble-ui-ink-muted);
	}
	.idle .die.empty {
		border-style: dashed;
	}
</style>
