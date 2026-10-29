<script lang="ts">
	import type { RollUsePickerProps } from '#types/components/RollUsePicker.d.ts';

	import DieValuePicker from './DieValuePicker.svelte';
	import RerollDiePicker from './RerollDiePicker.svelte';

	let {
		picking,
		feature,
		primaryOutcome = null,
		onpick,
		onvalue,
		oncancel,
	}: RollUsePickerProps = $props();
</script>

{#if picking.valueDie}
	<DieValuePicker
		die={picking.valueDie}
		{feature}
		{primaryOutcome}
		sending={!!picking.rolling}
		onpick={onvalue}
		{oncancel}
	/>
{:else}
	<RerollDiePicker
		dice={picking.dice}
		{feature}
		{primaryOutcome}
		use={picking.entry.use === 'change' ? 'change' : 'reroll'}
		rolling={picking.rolling}
		{onpick}
		{oncancel}
	/>
{/if}
