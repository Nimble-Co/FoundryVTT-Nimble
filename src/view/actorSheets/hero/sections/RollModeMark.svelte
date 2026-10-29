<!--
@component
The mark of a stacked roll mode that rules give: one plus for each advantage, one minus for each disadvantage.
-->
<script lang="ts">
	import type { RollModeMarkProps } from '#types/components/actorSheets/RollModeMark.d.ts';

	let { mode }: RollModeMarkProps = $props();

	const count = $derived(Math.abs(mode?.value ?? 0));
	const advantage = $derived((mode?.value ?? 0) > 0);
</script>

{#if mode && count}
	<span class="mark" class:advantage role="img" aria-label={mode.label} data-tooltip={mode.label}>
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
