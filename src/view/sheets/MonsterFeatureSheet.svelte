<script lang="ts">
	import { setContext } from 'svelte';
	import localize from '../../utils/localize.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';

	import Editor from './components/Editor.svelte';
	import ItemActivationConfigTab from './pages/ItemActivationConfigTab.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemMacroTab from './pages/ItemMacroTab.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';

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
			component: activationConfigTab,
			icon: 'fa-solid fa-play',
			tooltip: 'Activation',
			name: 'activationConfig',
		},
		{
			component: macroTab,
			icon: 'fa-solid fa-terminal',
			tooltip: 'Macro',
			name: 'macro',
		},
	];

	const subtypeOptions = [
		{ value: 'feature', label: 'Feature' },
		{ value: 'action', label: 'Action' },
		{ value: 'bloodied', label: 'Bloodied' },
		{ value: 'lastStand', label: 'Last Stand' },
	];

	let currentTab = $state(navigation[0]);

	let { item, sheet } = $props();

	setContext('document', item);
	setContext('application', sheet);
</script>

{#snippet activationConfigTab()}
	<ItemActivationConfigTab></ItemActivationConfigTab>
{/snippet}

{#snippet configTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		<label class="nimble-field nimble-field--full-width" data-field-variant="stacked">
			<h3 class="nimble-heading" data-heading-variant="field">Identifier</h3>

			<input
				type="text"
				value={item.reactive.identifier || ''}
				onchange={({ target }) =>
					item.update({
						'system.identifier': (target as HTMLInputElement).value,
					})}
			/>
		</label>

		<div class="form-group">
			<label class="nimble-field nimble-field--full-width" data-field-variant="stacked">
				Subtype
				<select
					name="system.subtype"
					value={item.system.subtype}
					onchange={({ target }) =>
						item.update({
							'system.subtype': (target as monsterFeatureTypesHTMLInputElement).value,
						})}
				>
					{#each subtypeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
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

{#snippet macroTab()}
	<ItemMacroTab></ItemMacroTab>
{/snippet}

<header class="nimble-sheet__header nimble-sheet__header--item">
	<section class="nimble-icon">
		<button
			class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small"
			type="button"
			aria-label={localize('NIMBLE.prompts.changeFeatureImage')}
			data-tooltip="NIMBLE.prompts.changeFeatureImage"
			onclick={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
		>
			<img class="nimble-icon__image" src={item.reactive?.img} alt={item.reactive.name} />
		</button>
	</section>

	<ItemHeader {item} placeholder="Feature Name" />
</header>

<PrimaryNavigation bind:currentTab {navigation} />

{@render currentTab.component()}
