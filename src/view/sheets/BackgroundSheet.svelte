<script>
	import { setContext } from 'svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage';

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

	setContext('document', item);
	setContext('application', sheet);
</script>

{#snippet configTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		<label>
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Identifier</h3>
			</header>

			<input
				type="text"
				value={item.reactive.identifier || ''}
				onchange={({ target }) => item.update({ 'system.identifier': target.value })}
			/>
		</label>
	</section>
{/snippet}

{#snippet descriptionTab()}
	{#key item.reactive.system.description}
		<section class="nimble-sheet__body nimble-sheet__body--item">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">Description</h3>
			</header>

			<Editor
				content={item.reactive.system.description}
				field="system.description"
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
			aria-label="Edit Item Image"
			data-tooltip="NIMBLE.prompts.changeBackgroundImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive?.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Background Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}
