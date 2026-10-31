<!--
@component
The Inspiration seal in the top-right corner of the portrait: crimson while the hero has Inspiration, a ghost ring
while not. A click gives it or ends it. The rail and the narrow header place it.
-->
<script lang="ts">
	import type { HeroInspirationSealProps } from '#types/components/actorSheets/HeroInspirationSeal.d.ts';

	let { inspiration, perform }: HeroInspirationSealProps = $props();
</script>

<button
	type="button"
	class="nimble-u-reset-button seal"
	class:on={inspiration.on}
	aria-pressed={inspiration.on}
	aria-label={inspiration.label}
	data-tooltip={inspiration.tooltip}
	onclick={() => perform(inspiration.intent)}
>
	<i class="fa-solid fa-star" aria-hidden="true"></i>
</button>

<style>
	.seal {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1.5px dashed var(--nimble-ui-edge);
		border-radius: 50%;
		background: var(--nimble-ui-scrim);
		font-size: 0.75rem;
		color: var(--nimble-ui-edge);
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.seal:hover {
		border-style: solid;
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-scrim-strong);
		color: var(--nimble-ui-highlight);
	}
	.seal.on {
		border: 1.5px solid var(--nimble-ui-highlight);
		background: var(--nimble-crimson);
		color: var(--nimble-ui-highlight);
		box-shadow: 0 2px 6px rgb(0 0 0 / 45%);
	}
	.seal.on:hover {
		background: color-mix(in srgb, var(--nimble-crimson), #fff 12%);
	}
	.seal:focus-visible {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 2px;
	}
</style>
