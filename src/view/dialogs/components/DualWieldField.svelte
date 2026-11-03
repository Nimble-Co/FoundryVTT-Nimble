<!--
@component
The tick of an attack's roll window for dual wielding, 1/round.
-->
<script lang="ts">
	import type { DualWieldFieldProps } from '#types/components/DualWieldField.d.ts';
	import localize from '#utils/localize.js';

	let {
		offer,
		itemName,
		rollMode,
		checked = $bindable(false),
		extraDieOn = $bindable('activated'),
	}: DualWieldFieldProps = $props();

	const TEXT = 'NIMBLE.rollWindow.dualWield';
</script>

<label class="check" data-tooltip={offer.used ? localize('NIMBLE.rollWindow.usedThisRound') : null}>
	<input type="checkbox" disabled={offer.used} bind:checked />
	<i class="fa-solid fa-hand-fist" aria-hidden="true"></i>
	<span>
		{offer.other
			? localize(`${TEXT}.withOther`, { other: offer.other.name })
			: localize(`${TEXT}.advantage`)}
	</span>
</label>
{#if checked && offer.other && rollMode > 0}
	<fieldset class="check nested">
		<legend>{localize(`${TEXT}.extraDie`)}</legend>
		<label>
			<input type="radio" value="activated" bind:group={extraDieOn} />
			<span>{itemName}</span>
		</label>
		<label>
			<input type="radio" value="other" bind:group={extraDieOn} />
			<span>{offer.other.name}</span>
		</label>
	</fieldset>
{/if}

<style lang="scss">
	.nested {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.25rem 0 0 1.5rem;
		padding: 0;
		border: 0;
	}
</style>
