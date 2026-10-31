<!--
@component
The fields of a roll window that change the dice: Add to Roll, Set Primary Die Result and Add to Primary Die Result.
-->
<script lang="ts">
	import type { RollModifierFieldsProps } from '#types/components/RollWindow.d.ts';
	import localize from '#utils/localize.js';

	const { hitDice } = CONFIG.NIMBLE;

	let {
		situationalModifiers = $bindable(),
		primaryDieValue = $bindable(),
		primaryDieModifier = $bindable(),
	}: RollModifierFieldsProps = $props();
</script>

<label class="fld">
	<span>{localize(hitDice.situationalModifiers)}</span>
	<input type="text" bind:value={situationalModifiers} placeholder="0" />
</label>
<div class="two">
	<label class="fld">
		<span>{localize(hitDice.setPrimaryDie)}</span>
		<input type="number" bind:value={primaryDieValue} placeholder="0" />
	</label>
	<label class="fld">
		<span>{localize(hitDice.setPrimaryDieModifier)}</span>
		<input type="number" bind:value={primaryDieModifier} placeholder="0" />
	</label>
</div>

<style>
	.two {
		display: flex;
		gap: 8px;
	}
	.two .fld {
		flex: 1;
		min-width: 0;
	}
</style>
