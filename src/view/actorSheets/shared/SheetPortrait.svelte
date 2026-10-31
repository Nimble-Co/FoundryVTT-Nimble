<!--
@component
The portrait behind the rail or the narrow header of both sheets. It moves and scales by the image settings,
and shows the fallback portrait when the image does not load. A core icon (no art yet) is a quiet placeholder.
-->
<script lang="ts">
	import type { SheetPortraitProps } from '#types/components/actorSheets/SheetPortrait.d.ts';
	import { PORTRAIT_FALLBACK_IMAGE } from '#view/ui/ctTopTracker/constants.js';

	let { view, form }: SheetPortraitProps = $props();

	let failedFor: string | null = $state(null);
	const src = $derived(failedFor === view.img ? PORTRAIT_FALLBACK_IMAGE : view.img);
	const placeholder = $derived(src.startsWith('icons/svg/'));
</script>

<div class="clip">
	<img
		class={form}
		class:placeholder
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
	.placeholder {
		top: 12%;
		height: 76%;
		object-fit: contain;
		object-position: center;
		opacity: 0.12;
	}
</style>
