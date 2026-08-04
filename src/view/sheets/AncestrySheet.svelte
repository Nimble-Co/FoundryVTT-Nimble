<script>
	import { setContext, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import DocumentPicker from '../components/DocumentPicker.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import Editor from './components/Editor.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';
	import Hint from '../components/Hint.svelte';
	import TagGroup from '../components/TagGroup.svelte';

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

	const { sizeCategories } = CONFIG.NIMBLE;

	let selectedSizes = $derived(item.reactive.system.size ?? []);

	const sizeOptions = Object.entries(sizeCategories).map(([value, label]) => ({
		value,
		label: localize(label),
	}));

	function toggleSize(sizeCategory) {
		const current = new Set(item.system.size ?? []);

		if (current.has(sizeCategory)) current.delete(sizeCategory);
		else current.add(sizeCategory);

		// Preserve the canonical ordering defined in CONFIG.NIMBLE.sizeCategories.
		const updatedSizes = Object.keys(sizeCategories).filter((key) => current.has(key));

		item.update({ 'system.size': updatedSizes });
	}

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
				<h3 class="nimble-heading" data-heading-variant="section">Size Options</h3>
			</header>

			<Hint
				hintText="Select one or more sizes available to this ancestry. When more than one is selected, the player chooses during character creation."
			/>

			<TagGroup options={sizeOptions} selectedOptions={selectedSizes} toggleOption={toggleSize} />
		</div>
	</section>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
	<section class="nimble-icon">
		<button
			class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
			type="button"
			aria-label={localize('NIMBLE.prompts.changeAncestryImage')}
			data-tooltip="NIMBLE.prompts.changeAncestryImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Ancestry Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab?.component?.()}
