<!--
@component
The tick of a roll window that uses a kept amount in place of a roll.
-->
<script lang="ts">
	import type { KeptAmountFieldProps } from '#types/components/KeptAmountField.d.ts';
	import localize from '#utils/localize.js';

	let { label, amount, checked = $bindable(true) }: KeptAmountFieldProps = $props();
</script>

<label class="check">
	<input type="checkbox" bind:checked />
	<i class="fa-solid fa-rotate" aria-hidden="true"></i>
	<span>{localize('NIMBLE.heldChange.keptTick', { label, amount: String(amount) })}</span>
</label>
