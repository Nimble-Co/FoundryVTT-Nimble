<script lang="ts">
	import type { CardResourceCost } from '#types/resourceCost.d.ts';
	import { cardCostLine } from '#utils/cost/resourceCostWords.js';
	import { getContext } from 'svelte';

	const messageDocument = getContext('messageDocument') as
		| { reactive?: { system?: { costs?: CardResourceCost[] } } }
		| undefined;

	const lines = $derived((messageDocument?.reactive?.system?.costs ?? []).map(cardCostLine));
</script>

{#if lines.length > 0}
	<section class="nimble-card-section nimble-cost-lines">
		{#each lines as line, index (index)}
			<p>{line}</p>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-cost-lines {
		font-size: var(--nimble-sm-text, 0.833rem);
		font-weight: 600;

		p {
			margin: 0;
		}
	}
</style>
