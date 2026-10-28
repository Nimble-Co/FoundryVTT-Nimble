<!--
@component
The mark of a stacked roll mode that rules give: one plus for each advantage, one minus for each disadvantage.
-->
<script lang="ts">
	import localize from '#utils/localize.js';

	interface Props {
		/** positive = advantage, negative = disadvantage */
		value: number;
	}

	let { value }: Props = $props();

	const count = $derived(Math.abs(value));
	const advantage = $derived(value > 0);
	const label = $derived(
		localize(`NIMBLE.actorSheet.parts.rollMode.${advantage ? 'advantage' : 'disadvantage'}`, {
			count: String(count),
		}),
	);
</script>

{#if count}
	<span class="mark" class:advantage role="img" aria-label={label} data-tooltip={label}>
		{#each { length: count }}<i class="fa-solid {advantage ? 'fa-circle-plus' : 'fa-circle-minus'}"
			></i>{/each}
	</span>
{/if}

<style>
	.mark {
		display: inline-flex;
		gap: 1px;
		font-size: 0.643rem;
		color: var(--nimble-ui-vital);
	}
	.mark.advantage {
		color: var(--nimble-ui-action);
	}
</style>
