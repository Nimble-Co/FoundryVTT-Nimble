<!--
@component
The head of a window: a tile and the name, with an optional line under it.
The Foundry header lies over the head, so a drag on the head moves the window (`_window.scss`).
`ontile` makes the tile a button, and `name` puts a field in place of the name.
-->
<script lang="ts">
	import type { WindowHeadProps } from '#types/components/actorSheets/WindowHead.d.ts';
	import RowTile from './RowTile.svelte';

	let { title, img, icon, sub, ontile, tileLabel, name }: WindowHeadProps = $props();
</script>

<div class="head">
	{#if ontile}
		<button
			type="button"
			class="nimble-u-reset-button tile-button"
			aria-label={tileLabel}
			data-tooltip={tileLabel}
			onclick={ontile}
		>
			<RowTile {img} {icon} />
		</button>
	{:else}
		<RowTile {img} {icon} />
	{/if}
	<span class="t">
		{#if name}{@render name()}{:else}<b>{title}</b>{/if}
		{#if sub}<small>{sub}</small>{/if}
	</span>
</div>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 32px;
		/* keeps the name clear of the window controls */
		padding-right: var(--nimble-window-controls, 26px);
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.tile-button {
		position: relative;
		z-index: 3;
		flex: none;
		border-radius: 4px;
	}
	.tile-button:hover {
		filter: brightness(1.1);
	}
	.tile-button:focus-visible {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 1px;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	b {
		font-size: 1.062rem;
		font-weight: 900;
		line-height: 1.1;
	}
	small {
		font-size: 0.781rem;
		font-weight: 500;
		line-height: 1.2;
		color: var(--nimble-ui-ink-muted);
	}
</style>
