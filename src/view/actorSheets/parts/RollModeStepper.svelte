<!--
@component
Advantage and disadvantage in the roll window. They stack, and each advantage cancels one disadvantage (Core Rules), so this is a count
from -6 to 6, as RollModeConfig in the system: "Advantage × 2", "Straight Roll", "Disadvantage × 1".
Never draw a three-way Disadvantage / Normal / Advantage switch.
-->
<script lang="ts">
	import type { RollModeStepperProps } from '#types/components/actorSheets/RollModeStepper.d.ts';
	import localize from '#utils/localize.js';

	let {
		value = $bindable(0),
		onchange,
		min = -6,
		max = 6,
		disTone = 'vital',
		fixed = false,
	}: RollModeStepperProps = $props();

	const label = $derived(
		value > 0
			? localize('NIMBLE.actorSheet.parts.rollMode.advantage', { count: String(value) })
			: value < 0
				? localize('NIMBLE.actorSheet.parts.rollMode.disadvantage', { count: String(-value) })
				: localize('NIMBLE.actorSheet.parts.rollMode.straight'),
	);

	function set(v: number) {
		value = Math.max(min, Math.min(max, v));
		onchange?.(value);
	}
</script>

<div class="mode" class:fixed>
	<button
		type="button"
		class="nimble-u-reset-button seg"
		aria-disabled={value <= min || undefined}
		data-tooltip={localize('NIMBLE.actorSheet.parts.rollMode.lessHint')}
		onclick={() => set(value - 1)}
		><i class="fa-solid fa-minus"></i>{localize(
			'NIMBLE.actorSheet.parts.rollMode.disadvantageButton',
		)}</button
	>
	<b
		aria-live="polite"
		class:adv={value > 0}
		class:dis={value < 0}
		class:warn={value < 0 && disTone === 'warn'}>{label}</b
	>
	<button
		type="button"
		class="nimble-u-reset-button seg"
		aria-disabled={value >= max || undefined}
		data-tooltip={localize('NIMBLE.actorSheet.parts.rollMode.moreHint')}
		onclick={() => set(value + 1)}
		><i class="fa-solid fa-plus"></i>{localize(
			'NIMBLE.actorSheet.parts.rollMode.advantageButton',
		)}</button
	>
</div>

<style>
	.mode {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--nimble-primary-font);
	}
	.seg {
		flex: none;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 0 9px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.781rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.seg:hover {
		border-color: var(--nimble-ui-highlight);
	}
	.seg[aria-disabled='true'] {
		opacity: 0.4;
		cursor: default;
	}
	.seg i {
		font-size: 0.625rem;
	}
	b {
		flex: 1;
		text-align: center;
		font-size: 0.875rem;
		color: var(--nimble-ui-ink);
	}
	.adv {
		color: var(--nimble-ui-action);
	}
	.dis {
		color: var(--nimble-ui-vital);
	}
	.dis.warn {
		color: var(--nimble-ui-warn);
	}
	.fixed .seg:first-child {
		width: 118px;
	}
	.fixed .seg:last-child {
		width: 104px;
	}
</style>
