<script>
	import { setContext, untrack } from 'svelte';
	import { getItemSourceId } from '../../utils/documents/itemSourceRules.js';
	import localize from '../../utils/localize.js';
	import DocumentPicker from '../components/DocumentPicker.svelte';
	import Hint from '../components/Hint.svelte';
	import ItemTabs from './components/ItemTabs.svelte';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import Editor from './components/Editor.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import SizeOptionsSelect from './components/SizeOptionsSelect.svelte';
	import VariantOptionsInput from './components/VariantOptionsInput.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';

	const navigation = [
		{
			component: descriptionTab,
			icon: 'fa-solid fa-file-lines',
			tooltip: 'Description',
			name: 'description',
		},
		{
			component: configTab,
			icon: 'fa-solid fa-gears',
			tooltip: 'Config',
			name: 'config',
		},
		{
			component: ItemRulesTab,
			icon: 'fa-solid fa-bolt',
			tooltip: 'Rules',
			name: 'rules',
		},
	];

	let { item, sheet } = $props();
	let currentTab = $state(navigation[0]);

	let exoticAncestry = $derived(item.reactive.system.exotic);
	let defaultBonusUuid = $derived(item.reactive.system.defaultBonus ?? '');
	let selectedSizes = $derived(item.reactive.system.size ?? []);
	let selectedVariants = $derived(item.reactive.system.variants ?? []);

	// Compendium ancestries are locked, so an editable one is a world copy. Its published sizes are
	// what removing the last size reverts to — the system default only applies to ancestries written
	// from scratch, which have no published version to go back to.
	let publishedSizes = $state([]);

	// The source never changes for an open sheet, so this reads the document rather than its reactive
	// proxy — tracking `_stats` would refetch on every edit.
	$effect(() => {
		const sourceUuid = getItemSourceId(untrack(() => item));
		if (!sourceUuid) return;

		let current = true;

		fromUuid(sourceUuid)
			.then((source) => {
				if (current) publishedSizes = source?.system?.size ?? [];
			})
			.catch(() => {
				if (current) publishedSizes = [];
			});

		return () => {
			current = false;
		};
	});

	setContext(
		'document',
		untrack(() => item),
	);
	setContext(
		'application',
		untrack(() => sheet),
	);
</script>

{#snippet descriptionTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		{#key item.reactive.system.description}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Ancestry Description</h3>
			</header>

			<Editor
				content={item.reactive.system.description}
				field="system.description"
				document={item}
			/>
		{/key}
	</section>
{/snippet}

{#snippet configTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Identifier</h3>
			</header>

			<input
				type="text"
				value={item.reactive.identifier || ''}
				onchange={({ target }) => item.update({ 'system.identifier': target.value })}
			/>
		</div>

		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Ancestry Configuration</h3>
			</header>

			<label class="nimble-field">
				<input
					type="checkbox"
					checked={exoticAncestry}
					onchange={({ target }) => item.update({ 'system.exotic': target?.checked })}
				/>

				<span class="nimble-field__label"> Exotic Ancestry </span>
			</label>
		</div>

		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ancestrySheet.defaultBonus')}
				</h3>
			</header>

			<DocumentPicker
				value={defaultBonusUuid}
				documentTypes={['Item.ancestryBonus']}
				placeholder={localize('NIMBLE.ancestrySheet.defaultBonusPlaceholder')}
				onChange={(next) => item.update({ 'system.defaultBonus': next })}
			/>
		</div>

		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ancestrySheet.sizeOptions')}
				</h3>
			</header>

			<Hint hintText={localize('NIMBLE.ancestrySheet.sizeOptionsHint')} />

			<SizeOptionsSelect
				{selectedSizes}
				{publishedSizes}
				onChange={(nextSizes) => item.update({ 'system.size': nextSizes })}
			/>
		</div>

		<div>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ancestrySheet.variants')}
				</h3>
			</header>

			<Hint hintText={localize('NIMBLE.ancestrySheet.variantsHint')} />

			<VariantOptionsInput
				{selectedVariants}
				ancestryName={item.reactive.name}
				onChange={(nextVariants) => item.update({ 'system.variants': nextVariants })}
			/>
		</div>
	</section>
{/snippet}

<header class="nimble-sheet__header nimble-window__head">
	<WindowHead
		img={item.reactive.img}
		tileLabel={localize('NIMBLE.prompts.changeAncestryImage')}
		ontile={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
	>
		{#snippet name()}<ItemHeader
				{item}
				placeholder={localize('NIMBLE.itemNamePlaceholder.ancestry')}
			/>{/snippet}
	</WindowHead>
</header>

<ItemTabs bind:currentTab {navigation} />

{@render currentTab?.component?.()}
