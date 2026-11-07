<script>
	import { setContext, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';

	import Editor from './components/Editor.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemMacroTab from './pages/ItemMacroTab.svelte';
	import ItemTabs from './components/ItemTabs.svelte';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';
	import TagGroup from '../components/TagGroup.svelte';

	function getBoonTypeOptions() {
		return Object.entries(boonTypes).map(([key, boonType]) => ({
			label: boonType,
			value: key,
		}));
	}

	function updateBoonType(newSelection) {
		item.update({
			'system.boonType': newSelection,
		});
	}

	let { item, sheet } = $props();

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
			component: rulesTab,
			icon: 'fa-solid fa-bolt',
			tooltip: 'Rules',
			name: 'rules',
		},
		{
			component: macroTab,
			icon: 'fa-solid fa-terminal',
			tooltip: 'Macro',
			name: 'macro',
		},
	];

	let currentTab = $state(navigation[0]);
	const { boonTypes } = CONFIG.NIMBLE;

	setContext(
		'document',
		untrack(() => item),
	);
	setContext(
		'application',
		untrack(() => sheet),
	);
</script>

{#snippet configTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		<div class="nimble-config-wrapper">
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
				<h3 class="nimble-heading" data-heading-variant="section">General Configuration</h3>
			</header>

			<div class="nimble-field nimble-field--column">
				<span class="nimble-heading" data-heading-variant="field"> Object Type </span>

				<TagGroup
					options={getBoonTypeOptions()}
					selectedOptions={[item.reactive.system.boonType]}
					toggleOption={updateBoonType}
				/>
			</div>
		</div>
	</section>
{/snippet}

{#snippet descriptionTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		{#key item.reactive.system.description}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Description</h3>
			</header>

			<Editor
				field="system.description"
				content={item.reactive.system.description}
				document={item}
			/>
		{/key}
	</section>
{/snippet}

{#snippet macroTab()}
	<ItemMacroTab></ItemMacroTab>
{/snippet}

{#snippet rulesTab()}
	<ItemRulesTab></ItemRulesTab>
{/snippet}

<header class="nimble-sheet__header nimble-window__head">
	<WindowHead
		img={item.reactive.img}
		tileLabel={localize('NIMBLE.prompts.changeBoonImage')}
		ontile={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
	>
		{#snippet name()}<ItemHeader {item} placeholder="Boon Name" />{/snippet}
	</WindowHead>
</header>

<ItemTabs bind:currentTab {navigation} />

{@render currentTab.component()}

<style lang="scss">
	.nimble-config-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		&:not(:last-of-type) {
			padding-block-end: 0.5rem;
		}
	}
</style>
