<script>
	import { setContext } from 'svelte';
	import localize from '../../utils/localize.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';

	import Editor from './components/Editor.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';

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
	];

	let currentTab = $state(navigation[0]);
	let parentClass = $derived(item.system.parentClass);

	setContext('document', item);
	setContext('application', sheet);
</script>

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
				<h3 class="nimble-heading" data-heading-variant="section">Parent Class</h3>
			</header>

			<input
				type="text"
				value={parentClass}
				onchange={({ target }) => item.update({ 'system.parentClass': target.value })}
			/>
		</div>
	</section>
{/snippet}

{#snippet descriptionTab()}
	{#key item.reactive.system.description}
		<section class="nimble-sheet__body nimble-sheet__body--item">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Description</h3>
			</header>

			<Editor
				field="system.description"
				content={item.reactive.system.description}
				document={item}
			/>
		</section>
	{/key}
{/snippet}

{#snippet rulesTab()}
	<ItemRulesTab></ItemRulesTab>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
	<section class="nimble-icon">
		<button
			class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
			type="button"
			aria-label={localize('NIMBLE.prompts.changeSubclassImage')}
			data-tooltip="NIMBLE.prompts.changeSubclassImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Subclass Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}
