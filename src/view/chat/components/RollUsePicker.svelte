<script lang="ts">
	import type { RollUsePickerProps } from '#types/components/RollUsePicker.d.ts';

	import DieValuePicker from './DieValuePicker.svelte';
	import RerollDiePicker from './RerollDiePicker.svelte';
	import RerollStatPicker from './RerollStatPicker.svelte';

	let {
		picking,
		feature,
		primaryOutcome = null,
		primaryDieBonuses = [],
		onpick,
		onseveral,
		onvalue,
		onstat,
		oncancel,
	}: RollUsePickerProps = $props();
</script>

{#if picking.stats}
	<RerollStatPicker
		stats={picking.stats}
		{feature}
		sending={picking.sent}
		onpick={onstat}
		{oncancel}
	/>
{:else if picking.valueDie}
	<DieValuePicker
		die={picking.valueDie}
		{feature}
		{primaryOutcome}
		{primaryDieBonuses}
		sending={!!picking.rolling}
		onpick={onvalue}
		{oncancel}
	/>
{:else}
	<RerollDiePicker
		dice={picking.dice}
		{feature}
		{primaryOutcome}
		use={picking.entry.use ?? 'reroll'}
		rolling={picking.rolling}
		several={picking.several ?? null}
		onconfirm={onseveral}
		{onpick}
		{oncancel}
	/>
{/if}
