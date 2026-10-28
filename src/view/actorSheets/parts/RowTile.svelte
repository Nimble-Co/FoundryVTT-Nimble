<!--
@component
The square image at the start of a row. The document art (`img`) fills the square. A Font Awesome `icon` shows only when there is no image.
The image of a row is the image of the thing; each image has one meaning on the sheet.
-->
<script lang="ts">
	interface Props {
		/** path to the document art */
		img?: string;
		/** Font Awesome class, when there is no image */
		icon?: string;
		/** md = 32 px (character row), sm = 24 px (NPC card), win = 28 px (the head of a small window) */
		size?: 'md' | 'sm' | 'win';
	}

	let { img, icon, size = 'md' }: Props = $props();
</script>

<span
	class="tile"
	class:sm={size === 'sm'}
	class:win={size === 'win'}
	class:art={!!img}
	aria-hidden="true"
>
	{#if img}
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
		font-size: 1rem;
	}
	.sm {
		width: 24px;
		height: 24px;
		border-radius: 3px;
		font-size: 0.786rem;
	}
	.win {
		width: 28px;
		height: 28px;
		font-size: 0.929rem;
	}
	.art {
		background-color: #000b;
	}
	img {
		width: 100%;
		height: 100%;
		border: 0;
		object-fit: cover;
	}
</style>
