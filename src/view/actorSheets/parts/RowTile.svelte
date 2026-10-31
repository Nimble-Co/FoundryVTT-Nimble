<!--
@component
The square image at the start of a row. The document art (`img`) fills the square; a core icon (no art yet) is a bronze
glyph on a dark tile. A Font Awesome `icon` shows only when there is no image.
The image of a row is the image of the thing; each image has one meaning on the sheet.
-->
<script lang="ts">
	import type { RowTileProps } from '#types/components/actorSheets/RowTile.d.ts';

	let { img, icon, size = 'md' }: RowTileProps = $props();

	const glyph = $derived(!!img && img.startsWith('icons/svg/'));
	// A url() in a custom property resolves against the stylesheet that uses it, not the page.
	const glyphUrl = $derived(glyph ? `url("${new URL(img as string, document.baseURI).href}")` : '');
</script>

<span
	class="tile"
	class:sm={size === 'sm'}
	class:win={size === 'win'}
	class:art={!!img}
	aria-hidden="true"
>
	{#if glyph}
		<span class="glyph" style:--glyph={glyphUrl}></span>
	{:else if img}
		<img src={img} alt="" />
	{:else if icon}
		<i class={icon}></i>
	{/if}
</span>

<style>
	.tile {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		overflow: hidden;
		border-radius: 4px;
		background: var(--nimble-ui-tile);
		color: var(--nimble-ui-tile-ink);
		font-size: 0.875rem;
	}
	.sm {
		width: 24px;
		height: 24px;
		border-radius: 3px;
		font-size: 0.688rem;
	}
	.win {
		width: 28px;
		height: 28px;
		font-size: 0.813rem;
	}
	.art {
		background-color: #000b;
	}
	.glyph {
		width: 72%;
		height: 72%;
		background: var(--nimble-bronze);
		mask: var(--glyph) no-repeat center / contain;
	}
	img {
		width: 100%;
		height: 100%;
		border: 0;
		object-fit: cover;
	}
</style>
