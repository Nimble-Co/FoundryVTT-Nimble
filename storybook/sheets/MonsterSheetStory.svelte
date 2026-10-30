<!--
@component
The NPC sheet in a window box for the stories: fixture actors, the real view model, its own UI state,
and a `perform` that only logs. `tab` is the tab at the start, and `editing` starts edit mode. A `nimble-story:reveal` event on `window`
calls `revealIn`, as outside code calls `sheet.reveal()`.
-->
<script lang="ts">
	import type { MonsterSheetStoryProps } from '#types/components/actorSheets/MonsterSheetStory.d.ts';
	import MonsterSheet from '#view/actorSheets/monster/MonsterSheet.svelte';
	import {
		createSheetUiState,
		type RevealRequest,
		revealIn,
	} from '#view/actorSheets/shared/sheetUiState.ts';

	let {
		source,
		perform,
		width,
		height,
		tab = 'abilities',
		editing = false,
		theme = '',
	}: MonsterSheetStoryProps = $props();

	const ui = $state(createSheetUiState('abilities'));

	$effect.pre(() => {
		ui.tab = tab;
		ui.editing = editing;
	});

	$effect(() => {
		const onReveal = (event: Event) => revealIn(ui, (event as CustomEvent<RevealRequest>).detail);
		window.addEventListener('nimble-story:reveal', onReveal);
		return () => window.removeEventListener('nimble-story:reveal', onReveal);
	});
</script>

<div
	class="window nimble-actor-sheet nimble-actor-sheet--monster {theme}"
	style:width="{width}px"
	style:height="{height}px"
>
	<MonsterSheet {source} {ui} {perform} />
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
