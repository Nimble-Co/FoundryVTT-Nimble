<!--
@component
The ticks of a roll window that take the max of a roll in place of rolling it.
-->
<script lang="ts">
	import type { MaxDamageChoice, MaxDamageOffer } from '#types/maxDamage.d.ts';
	import localize from '#utils/localize.js';

	let {
		offers,
		choice = $bindable(null),
	}: { offers: MaxDamageOffer[]; choice: MaxDamageChoice | null } = $props();

	const TEXT = 'NIMBLE.rollWindow.maxDamage';

	function tick(offer: MaxDamageOffer, checked: boolean) {
		choice = checked ? { key: offer.key, tempHp: false } : null;
	}

	function label(offer: MaxDamageOffer): string {
		const key = offer.use === 'healing' ? 'healing' : 'damage';
		const text = localize(`${TEXT}.${key}`, { feature: offer.label });
		if (offer.chargeCost < 1) return text;
		return localize(`${TEXT}.withCost`, { text, count: String(offer.chargeCost) });
	}
</script>

{#each offers as offer (offer.key)}
	<label class="check" data-tooltip={offer.canPay ? null : localize(`${TEXT}.noUses`)}>
		<input
			type="checkbox"
			disabled={!offer.canPay}
			checked={choice?.key === offer.key}
			onchange={({ currentTarget }) => tick(offer, currentTarget.checked)}
		/>
		<i class="fa-solid fa-angles-up" aria-hidden="true"></i>
		<span>{label(offer)}</span>
	</label>
	{#if offer.tempHpChoice && choice?.key === offer.key}
		<label class="check nested">
			<input
				type="checkbox"
				checked={choice.tempHp}
				onchange={({ currentTarget }) => {
					choice = { key: offer.key, tempHp: currentTarget.checked };
				}}
			/>
			<span>{localize(`${TEXT}.tempHp`)}</span>
		</label>
	{/if}
{/each}

<style>
	.nested {
		margin-inline-start: 22px;
	}
</style>
