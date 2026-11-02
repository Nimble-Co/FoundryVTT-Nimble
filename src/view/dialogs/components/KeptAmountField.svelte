<!--
@component
The tick of a roll window that uses a kept amount in place of a roll.
-->
<script lang="ts">
	import localize from '#utils/localize.js';

	interface Props {
		label: string;
		amount: number;
		checked: boolean;
	}

	let { label, amount, checked = $bindable(true) }: Props = $props();
</script>

<label class="check">
	<input type="checkbox" bind:checked />
	<i class="fa-solid fa-rotate" aria-hidden="true"></i>
	<span>{localize('NIMBLE.heldChange.keptTick', { label, amount: String(amount) })}</span>
</label>
