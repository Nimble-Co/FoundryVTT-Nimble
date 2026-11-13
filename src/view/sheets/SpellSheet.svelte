<script lang="ts">
	import localize from '#utils/localize.js';
	import { setContext, untrack } from 'svelte';
	import type { NimbleSpellItem } from '../../documents/item/spell.js';
	import type SpellSheet from '../../documents/sheets/SpellSheet.svelte.js';
	import ItemTabs from './components/ItemTabs.svelte';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';
	import prepareSpellMetaData from '../dataPreparationHelpers/metaData/prepareSpellMetadata.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemActivationConfigTab from './pages/ItemActivationConfigTab.svelte';
	import ItemEffectsTab from './pages/ItemEffectsTab.svelte';
	import ItemMacroTab from './pages/ItemMacroTab.svelte';
	import SpellConfigTab from './pages/SpellConfigTab.svelte';
	import SpellDescriptionTab from './pages/SpellDescriptionTab.svelte';
	import SpellSummaryTab from './pages/SpellSummaryTab.svelte';

	interface Props {
		item: NimbleSpellItem;
		sheet: SpellSheet;
	}

	const navigation = [
		{
			component: SpellSummaryTab,
			icon: 'fa-solid fa-rectangle-list',
			tooltip: 'Summary',
			name: 'summary',
		},
		{
			component: SpellDescriptionTab,
			icon: 'fa-solid fa-file-lines',
			tooltip: 'Description',
			name: 'description',
		},
		{
			component: SpellConfigTab,
			icon: 'fa-solid fa-cog',
			tooltip: 'Configuration',
			name: 'configuration',
		},
		{
			component: ItemActivationConfigTab,
			icon: 'fa-solid fa-play',
			tooltip: 'Activation',
			name: 'activationConfig',
		},
		{
			component: ItemEffectsTab,
			icon: 'fa-solid fa-heart-pulse',
			tooltip: 'NIMBLE.itemEffectsTab.tab',
			name: 'effects',
		},
		{
			component: ItemMacroTab,
			icon: 'fa-solid fa-terminal',
			tooltip: 'Macro',
			name: 'macro',
		},
	];

	let { item, sheet }: Props = $props();

	let currentTab = $state(navigation[0]);
	let metadata = $derived(prepareSpellMetaData(item.reactive) ?? '');

	setContext(
		'document',
		untrack(() => item),
	);
	setContext(
		'application',
		untrack(() => sheet),
	);
</script>

<header class="nimble-sheet__header nimble-window__head">
	<WindowHead
		img={item.reactive.img}
		tileLabel={localize('NIMBLE.prompts.changeSpellImage')}
		ontile={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		sub={metadata}
	>
		{#snippet name()}<ItemHeader
				{item}
				placeholder={localize('NIMBLE.itemNamePlaceholder.spell')}
			/>{/snippet}
	</WindowHead>
</header>

<ItemTabs bind:currentTab {navigation} />

<currentTab.component />
