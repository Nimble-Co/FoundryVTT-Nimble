<!--
@component
The character sheet in a window box for the stories: fixture actors, the real view model, its own UI state,
and a `perform` that only logs. It keeps the actions left, so a click on an action cell spends it.
`tab` is the tab at the start. A `nimble-story:reveal` event on `window` calls `revealIn`, as outside code calls `sheet.reveal()`.
-->
<script lang="ts">
	import type { HeroSheetStoryProps } from '#types/components/actorSheets/HeroSheetStory.d.ts';
	import HeroSheet from '#view/actorSheets/hero/HeroSheet.svelte';
	import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
	import type { HeroSource } from '#view/actorSheets/hero/heroSource.ts';
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
		editing,
		tab = 'core',
		theme = '',
	}: HeroSheetStoryProps = $props();

	const ui = $state(createSheetUiState('core'));
	let actionsLeft: number | null = $state(null);

	const shown = $derived.by((): HeroSource => {
		const current = source();
		const combat = current.context.combat;
		if (actionsLeft === null || !combat) return current;
		return {
			...current,
			context: {
				...current.context,
				combat: { ...combat, actions: { ...combat.actions, current: actionsLeft } },
			},
		};
	});

	const play: HeroPerform = (intent) => {
		if (intent.kind === 'setActions') actionsLeft = intent.value;
		return perform(intent);
	};

	$effect.pre(() => {
		ui.editing = editing;
	});

	$effect.pre(() => {
		ui.tab = tab;
	});

	$effect(() => {
		const onReveal = (event: Event) => revealIn(ui, (event as CustomEvent<RevealRequest>).detail);
		window.addEventListener('nimble-story:reveal', onReveal);
		return () => window.removeEventListener('nimble-story:reveal', onReveal);
	});
</script>

<div
	class="window nimble-actor-sheet nimble-actor-sheet--hero {theme}"
	style:width="{width}px"
	style:height="{height}px"
>
	<HeroSheet source={() => shown} {ui} perform={play} />
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
