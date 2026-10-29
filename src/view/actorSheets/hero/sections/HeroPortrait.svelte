<!--
@component
The portrait behind the rail or the narrow header. It moves and scales by the image settings,
and shows the fallback portrait when the image does not load.
-->
<script lang="ts">
	import type { HeroPortraitProps } from '#types/components/actorSheets/HeroPortrait.d.ts';
	import { PORTRAIT_FALLBACK_IMAGE } from '#view/ui/ctTopTracker/constants.js';

	let { view, form }: HeroPortraitProps = $props();

	let failedFor: string | null = $state(null);
	const src = $derived(failedFor === view.img ? PORTRAIT_FALLBACK_IMAGE : view.img);
</script>

<div class="clip">
	<img
		class={form}
		{src}
		alt={view.name}
		draggable="false"
		style:translate="{view.portrait.x}px {view.portrait.y}px"
		style:scale={view.portrait.scale / 100}
		onerror={() => (failedFor = view.img)}
	/>
</div>

<style>
	.clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	img {
		position: absolute;
		top: 0;
		height: 100%;
		max-width: none;
		border: 0;
		object-fit: cover;
	}
	.rail {
		left: 0;
		width: 100%;
		object-position: center 14%;
		transform-origin: top center;
	}
	.header {
		right: 0;
		width: 44%;
		object-position: center 12%;
		transform-origin: top right;
	}
</style>
