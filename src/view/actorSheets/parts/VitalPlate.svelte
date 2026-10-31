<!--
@component
A vital number on the rail. You type the current value (`InlineNumber`). The maximum shows after a slash. It changes in the configure window,
or, with `onmaxchange` (the NPC sheet in edit mode), it is a number that you type too.
A vital state shows in words on the plate, at the place that it changes: pass `state="Bloodied"` or `state="Dying"`
and the label and the number turn to the vital colour. A minion has no HP, so it has no plate.
The plate sits on the rail, which stays dark in both themes: put it inside `nimble-chrome`.

`variant="badge"` is the plate of the NPC rail: 118 px wide with a maximum (HP), 74 px without (Temp HP).
`variant="block"` is the plate of the character rail: a framed number over a bronze strip, which fills its grid cell. A vital state turns
the strip crimson; `dying` also turns the frame to the vital colour. `compact` is the smaller plate of the phone header.
-->
<script lang="ts">
	import type { VitalPlateProps } from '#types/components/actorSheets/VitalPlate.d.ts';
	import localize from '#utils/localize.js';
	import InlineNumber from './InlineNumber.svelte';

	let {
		label,
		value,
		max,
		onchange,
		state,
		dying = false,
		temp = false,
		variant = 'badge',
		compact = false,
		icon,
		tooltip,
		rest = false,
		onmaxchange,
	}: VitalPlateProps = $props();

	const shownLabel = $derived(label ?? localize('NIMBLE.actorSheet.parts.vitalPlate.hp'));
	const inputLabel = $derived(
		temp
			? localize('NIMBLE.actorSheet.parts.vitalPlate.tempHp')
			: localize('NIMBLE.actorSheet.parts.vitalPlate.current', { label: shownLabel }),
	);
	const maxLabel = $derived(
		localize('NIMBLE.actorSheet.parts.vitalPlate.maximum', { label: shownLabel }),
	);
</script>

{#snippet maximum(top: number)}
	{#if onmaxchange}<InlineNumber
			value={top}
			onchange={onmaxchange}
			label={maxLabel}
			align="center"
			min={1}
			dotted
			width="2.2em"
		/>{:else}{top}{/if}
{/snippet}

{#if variant === 'block'}
	<div class="blk" class:compact class:pb={state && !dying} class:pd={dying} data-tooltip={tooltip}>
		<b
			><InlineNumber
				{value}
				{onchange}
				label={inputLabel}
				align="center"
				min={0}
				{max}
				width={compact ? '40px' : '46px'}
				{rest}
			/>{#if max !== undefined}{' '}<small>/ {@render maximum(max)}</small>{/if}</b
		>
		<span
			>{state ?? shownLabel}{#if icon}{' '}<i class={icon}></i>{/if}</span
		>
	</div>
{:else}
	<div class="plate" class:temp class:vital={!!state} class:wide={max !== undefined}>
		<div class="pv">
			<InlineNumber
				{value}
				{onchange}
				label={inputLabel}
				align={max !== undefined ? 'right' : 'center'}
				min={0}
				width={temp ? '1.6em' : undefined}
				{rest}
			/>
			{#if max !== undefined}<small>/ {@render maximum(max)}</small>{/if}
		</div>
		<div class="pt">{state ?? shownLabel}</div>
	</div>
{/if}

<style>
	.plate {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		min-width: 74px;
		font-family: var(--nimble-primary-font);
	}
	.wide {
		min-width: 118px;
	}
	.pv {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 4px;
		width: 100%;
		padding: 5px 10px 4px;
		background: var(--nimble-ui-chrome);
		border: 1px solid var(--nimble-parchment);
		border-radius: 5px;
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1;
		color: hsl(36, 58%, 90%);
	}
	.pv small {
		font-size: 0.875rem;
		color: var(--nimble-bronze);
	}
	.pv small :global(.num) {
		color: var(--nimble-bronze);
	}
	.pt {
		margin-top: -1px;
		padding: 2px 14px 3px;
		background: var(--nimble-bronze);
		font-size: 0.688rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--nimble-ui-chrome);
		clip-path: polygon(0 0, 100% 0, 88% 100%, 12% 100%);
	}
	.temp .pt {
		padding: 2px 10px 3px;
		background: var(--nimble-parchment);
	}
	.vital .pv {
		border-color: var(--nimble-ui-vital);
		color: var(--nimble-ui-vital);
	}
	.vital .pt {
		background: var(--nimble-crimson);
		color: #fff;
	}
	.blk {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		border: 1px solid var(--nimble-ui-highlight);
		border-radius: 5px;
		overflow: hidden;
		text-align: center;
		font-family: var(--nimble-primary-font);
	}
	.blk b {
		padding: 5px 8px 4px;
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1;
		color: var(--nimble-ui-ink);
	}
	.blk b small {
		font-size: 0.813rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-dim);
	}
	.blk b :global(.num) {
		height: 26px;
		margin: -2px 0;
		padding: 0 3px;
		color: var(--nimble-ui-ink);
	}
	.blk > span {
		padding: 2px 0 3px;
		background: var(--nimble-bronze);
		font-size: 0.688rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 1;
		text-transform: uppercase;
		color: #181821;
	}
	.compact b {
		font-size: 1.125rem;
	}
	.compact b :global(.num) {
		height: 24px;
	}
	.pb > span,
	.pd > span {
		background: var(--nimble-crimson);
		color: #fff;
	}
	.pd {
		border-color: var(--nimble-ui-vital);
		background: hsla(1, 60%, 40%, 0.3);
	}
</style>
