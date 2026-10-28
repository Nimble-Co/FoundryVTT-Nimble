<!--
@component
The character sheet in a window box for the stories: fixture actors, the real view model, its own UI state,
and a `perform` that only logs.
-->
<script lang="ts">
	import HeroSheet from '#view/actorSheets/hero/HeroSheet.svelte';
	import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
	import type { HeroSource } from '#view/actorSheets/hero/heroSource.ts';
	import { createSheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

	interface Props {
		source: () => HeroSource;
		perform: HeroPerform;
		width: number;
		height: number;
		editing: boolean;
		/** theme-light or theme-dark; leave it out to follow the toolbar */
		theme?: string;
	}

	let { source, perform, width, height, editing, theme = '' }: Props = $props();

	const ui = $state(createSheetUiState('core'));

	$effect.pre(() => {
		ui.editing = editing;
	});
</script>

<div
	class="window nimble-actor-sheet nimble-actor-sheet--hero {theme}"
	style:width="{width}px"
	style:height="{height}px"
>
	<HeroSheet {source} {ui} {perform} />
</div>

<style>
	.window {
		max-width: 100%;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 6px;
		box-shadow: var(--nimble-sheet-shadow);
		overflow: hidden;
	}
</style>
