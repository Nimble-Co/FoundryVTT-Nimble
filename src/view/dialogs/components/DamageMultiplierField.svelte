<!--
@component
The tick of a roll window that multiplies the damage of the item.
-->
<script lang="ts">
	import type { DamageMultiplierFieldProps } from '#types/components/DamageMultiplierField.d.ts';
	import localize from '#utils/localize.js';

	let { label, multiplier, checked = $bindable(true) }: DamageMultiplierFieldProps = $props();
</script>

<label class="check">
	<input type="checkbox" bind:checked />
	<i class="fa-solid fa-xmark" aria-hidden="true"></i>
	<span
		>{localize(
			label ? 'NIMBLE.rules.damageMultiplier.tick' : 'NIMBLE.rules.damageMultiplier.onCard',
			{
				label,
				multiplier: String(multiplier),
			},
		)}</span
	>
</label>
