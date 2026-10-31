<!--
@component
Advantage and disadvantage in a roll window: a slider from Disadvantage × 6 to Advantage × 6, and one line that says what the count does.
Each advantage cancels one disadvantage (Core Rules), so the middle is a Straight Roll and the fill grows from the middle.
-->
<script lang="ts">
	import RangeSlider from 'svelte-range-slider-pips';
	import type { RollModeFieldProps } from '#types/components/RollWindow.d.ts';
	import localize from '#utils/localize.js';

	let { value = $bindable(0), rushedAttack }: RollModeFieldProps = $props();

	const MODE = 'NIMBLE.actorSheet.parts.rollMode';
	const HELP = 'NIMBLE.rollWindow.rollModeHelp';
	const MAX = 6;

	const readout = (mode: number) =>
		mode > 0
			? localize(`${MODE}.advantage`, { count: String(mode) })
			: mode < 0
				? localize(`${MODE}.disadvantage`, { count: String(-mode) })
				: localize(`${MODE}.straight`);

	const help = $derived.by(() => {
		if (value === 0) return localize(`${HELP}.straight`);
		const count = String(Math.abs(value));
		const dice = localize(`${HELP}.${Math.abs(value) > 1 ? 'dice' : 'die'}`);
		return localize(`${HELP}.${value > 0 ? 'advantage' : 'disadvantage'}`, { count, dice });
	});
	const heading = localize('NIMBLE.rollWindow.rollMode');
</script>

<div class="roll-mode" class:adv={value > 0} class:dis={value < 0}>
	<div class="lb">{heading}</div>
	<div class="line">
		<span class="end">{localize(`${MODE}.disadvantageButton`)}</span>
		<b aria-live="polite">{readout(value)}</b>
		<span class="end">{localize(`${MODE}.advantageButton`)}</span>
	</div>
	<div class="rail" style:--fill="{(Math.abs(value) / (MAX * 2)) * 100}%">
		<span class="fill"></span>
		<RangeSlider
			pips
			all="label"
			min={-MAX}
			max={MAX}
			formatter={(mode: number) => String(Math.abs(mode))}
			handleFormatter={readout}
			ariaLabels={[heading]}
			spring={false}
			bind:value
		/>
	</div>
	<p class="help">{help}</p>
	{#if rushedAttack}
		<p class="rush">
			{localize('NIMBLE.rollWindow.rushedAttack', {
				attack: String(rushedAttack),
				count: String(rushedAttack - 1),
			})}
		</p>
	{/if}
</div>

<style>
	.roll-mode {
		--tone: var(--nimble-ui-ink);
	}
	.adv {
		--tone: var(--nimble-ui-action);
	}
	.dis {
		--tone: var(--nimble-ui-warn);
	}
	.line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.line b {
		flex: 1;
		text-align: center;
		font-size: 0.875rem;
		color: var(--tone);
	}
	.end {
		flex: 0 0 5.5rem;
		font-size: 0.688rem;
		font-weight: 700;
		color: var(--nimble-ui-ink-muted);
	}
	.end:last-child {
		text-align: right;
	}
	.adv .end:last-child,
	.dis .end:first-child {
		color: var(--tone);
	}
	.rail {
		position: relative;
		margin: 8px 8px 0;
	}
	.fill {
		position: absolute;
		z-index: 1;
		top: 0;
		left: 50%;
		width: var(--fill);
		height: 6px;
		background: var(--tone);
		pointer-events: none;
	}
	.dis .fill {
		left: auto;
		right: 50%;
	}
	.rail :global(.rangeSlider) {
		--range-slider: var(--nimble-ui-well);
		--range-handle: var(--nimble-ui-ink);
		--range-handle-focus: var(--nimble-ui-ink);
		--range-handle-inactive: var(--nimble-ui-ink);
		height: 6px;
		margin: 0 0 30px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		font-size: 0.688rem;
		cursor: pointer;
	}
	.rail :global(.rangeHandle) {
		z-index: 2;
		top: 3px;
		width: 18px;
		height: 18px;
	}
	.rail :global(.rangeNub) {
		inset: 2px;
		border-radius: 50%;
		background: var(--nimble-ui-ink);
		box-shadow:
			0 0 0 2px var(--tone),
			0 1px 3px rgb(0 0 0 / 45%);
	}
	.rail :global(.rangeHandle::before),
	.rail :global(.rangeHandle::after) {
		display: none;
	}
	.rail :global(.rangeHandle:focus-visible) {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 2px;
		border-radius: 50%;
	}
	.rail :global(.rangePips) {
		top: 8px;
		height: 18px;
		color: var(--nimble-ui-ink-muted);
	}
	.rail :global(.rsPip) {
		width: 1px;
		height: 3px;
		background: var(--nimble-ui-ring);
		color: var(--nimble-ui-ink-muted);
	}
	.rail :global(.rsPipVal) {
		top: 5px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--nimble-ui-ink-muted);
	}
	.rail :global(.rsPip.rsSelected) {
		height: 3px;
		background: var(--tone);
	}
	.rail :global(.rsPip.rsSelected .rsPipVal) {
		top: 5px;
		transform: translate(-50%, 0);
		font-size: 1em;
		font-weight: 900;
		color: var(--tone);
	}
	.help {
		margin: 0;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);
	}
	.rush {
		margin: 6px 0 0;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink);
	}
</style>
