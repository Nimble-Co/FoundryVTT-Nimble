<!--
@component
The window of a Nimble Active Effect: Details, Lasts Until, Changes and Rules.
Each field saves when it changes, as in the item windows.
-->
<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import type { EffectSheetProps } from '#types/components/EffectSheet.d.ts';
	import localize from '#utils/localize.js';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';
	import updateDocumentImage from '#view/handlers/updateDocumentImage.js';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemTabs from './components/ItemTabs.svelte';
	import EffectChangesTab from './pages/EffectChangesTab.svelte';
	import EffectDetailsTab from './pages/EffectDetailsTab.svelte';
	import EffectLastsUntilTab from './pages/EffectLastsUntilTab.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';

	let { effect, sheet }: EffectSheetProps = $props();

	const TABS = 'NIMBLE.effectSheet.tabs';

	const navigation = [
		{
			component: detailsTab,
			icon: 'fa-solid fa-book',
			tooltip: `${TABS}.details`,
			name: 'details',
		},
		{
			component: lastsUntilTab,
			icon: 'fa-solid fa-hourglass-half',
			tooltip: `${TABS}.lastsUntil`,
			name: 'lastsUntil',
		},
		{
			component: changesTab,
			icon: 'fa-solid fa-gears',
			tooltip: `${TABS}.changes`,
			name: 'changes',
		},
		{
			component: rulesTab,
			icon: 'fa-solid fa-bolt',
			tooltip: `${TABS}.rules`,
			name: 'rules',
		},
	];

	let currentTab = $state(navigation[0]);

	setContext(
		'document',
		untrack(() => effect),
	);
	setContext(
		'application',
		untrack(() => sheet),
	);
</script>

{#snippet detailsTab()}
	<EffectDetailsTab {effect} />
{/snippet}

{#snippet lastsUntilTab()}
	<EffectLastsUntilTab {effect} />
{/snippet}

{#snippet changesTab()}
	<EffectChangesTab {effect} />
{/snippet}

{#snippet rulesTab()}
	<ItemRulesTab />
{/snippet}

<header class="nimble-sheet__header nimble-window__head">
	<WindowHead
		img={effect.reactive.img ?? undefined}
		tileLabel={localize('NIMBLE.effectSheet.changeImage')}
		ontile={(event: MouseEvent) => updateDocumentImage(effect, { shiftKey: event.shiftKey })}
	>
		{#snippet name()}<ItemHeader
				item={effect}
				placeholder={localize('NIMBLE.effectSheet.namePlaceholder')}
			/>{/snippet}
	</WindowHead>
</header>

<ItemTabs bind:currentTab {navigation} />

{@render currentTab.component()}
