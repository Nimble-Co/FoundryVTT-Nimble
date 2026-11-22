<script lang="ts">
	import { SYSTEM_ID } from '#system';
	import type { ChargeConsumptionDetail } from '#utils/chargePool/types.js';
	import { chargeConsumptionLine } from './chargeConsumptionLine.ts';
	import { getContext } from 'svelte';

	const messageDocument = getContext<
		{ reactive?: { flags?: Record<string, unknown> } } | undefined
	>('messageDocument');
	let consumption = $derived(
		((messageDocument?.reactive?.flags?.[SYSTEM_ID] as { chargeConsumption?: unknown } | undefined)
			?.chargeConsumption ?? []) as ChargeConsumptionDetail[],
	);
	let lines = $derived(consumption.map(chargeConsumptionLine));
</script>

{#if lines.length > 0}
	<section class="nimble-charge-consumption">
		{#each lines as line, index (index)}
			<p class="nimble-charge-consumption__entry" data-tooltip={line.tooltip}>
				{line.text}
			</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-charge-consumption {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
	}

	.nimble-charge-consumption__entry {
		margin: 0;
		font-size: var(--nimble-sm-text, 0.833rem);
	}
</style>
