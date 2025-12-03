<script lang="ts">
	import { setContext } from 'svelte';

	import prepareSpellMetaData from '../dataPreparationHelpers/metaData/prepareSpellMetadata.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';

	import ItemActivationConfigTab from './pages/ItemActivationConfigTab.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemMacroTab from './pages/ItemMacroTab.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import SpellConfigTab from './pages/SpellConfigTab.svelte';
	import SpellDescriptionTab from './pages/SpellDescriptionTab.svelte';
	import SpellSummaryTab from './pages/SpellSummaryTab.svelte';
	import type { NimbleSpellItem } from '../../documents/item/spell.js';

	interface Props {
		item: NimbleSpellItem;
		sheet: foundry.applications.api.DocumentSheetV2.Any;
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
			component: ItemMacroTab,
			icon: 'fa-solid fa-terminal',
			tooltip: 'Macro',
			name: 'macro',
		},
	];

	let { item, sheet }: Props = $props();

	let currentTab = $state(navigation[0]);
	let metadata = $derived(prepareSpellMetaData(item.reactive) ?? '');

	setContext('document', item);
	setContext('application', sheet);
</script>

<header class="nimble-sheet__header nimble-sheet__header--spell">
	<section class="nimble-icon">
		<button
			class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
			type="button"
			aria-label="NIMBLE.prompts.changeSpellImage"
			data-tooltip="NIMBLE.prompts.changeSpellImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Spell Name" />

	<span class="nimble-spell-metadata">{metadata}</span>
</header>

<PrimaryNavigation bind:currentTab {navigation} condenseNavigation={true} />

<currentTab.component />

<style lang="scss">
	.nimble-spell-metadata {
		grid-area: metadata;
		font-weight: 500;
	}
</style>
