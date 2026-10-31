<!--
@component
The strip under the tabs of the narrow character sheet: one chip for each track and pool. A chip opens its meter
under the chips, where you change it.
-->
<script lang="ts">
	import type { HeroStripProps } from '#types/components/actorSheets/HeroStrip.d.ts';
	import HeroMeter from './HeroMeter.svelte';

	let { meters, ui, perform }: HeroStripProps = $props();

	let openId: string | null = $state(null);
	const open = $derived(meters.find((meter) => meter.id === openId) ?? null);
</script>

<section class="strip">
	<div class="chips">
		{#each meters as meter (meter.id)}
			<button
				type="button"
				class="nimble-u-reset-button chip"
				aria-expanded={openId === meter.id}
				onclick={() => (openId = openId === meter.id ? null : meter.id)}
			>
				<span>{meter.label}</span>
				<b>{meter.summary}</b>
			</button>
		{/each}
	</div>
	{#if open}
		<HeroMeter meter={open} {ui} {perform} />
	{/if}
</section>

<style>
	.strip {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 7px 10px;
		border-bottom: 1px solid var(--nimble-ui-soft);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 5px;
		font-size: 0.688rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
		white-space: nowrap;
	}
	.chip b {
		font-size: 0.75rem;
		letter-spacing: 0;
		color: var(--nimble-ui-ink);
	}
	.chip:hover,
	.chip[aria-expanded='true'] {
		border-color: var(--nimble-ui-highlight);
	}
</style>
