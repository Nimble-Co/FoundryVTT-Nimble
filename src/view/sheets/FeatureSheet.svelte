<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';

	import Editor from './components/Editor.svelte';
	import ItemActivationConfigTab from './pages/ItemActivationConfigTab.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemMacroTab from './pages/ItemMacroTab.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import TagGroup from '../components/TagGroup.svelte';
	import { createFeatureSheetState } from './FeatureSheet.state.svelte.ts';
	import type { FeatureSheetProps } from '#types/components/FeatureSheet.d.ts';
	import {
		FEATURE_SHEET_TAB_CONFIG,
		FEATURE_TYPE_CLASS,
		type FeatureSheetTabName,
	} from './FeatureSheetConstants.js';

	let { item, sheet }: FeatureSheetProps = $props();

	const featureState = createFeatureSheetState(() => ({ item, sheet }));

	const snippetsByTab: Record<FeatureSheetTabName, () => void> = {
		description: descriptionTab,
		config: configTab,
		activationConfig: activationConfigTab,
		rules: rulesTab,
		macro: macroTab,
	};

	const navigation = FEATURE_SHEET_TAB_CONFIG.map((tab) => ({
		...tab,
		component: snippetsByTab[tab.name],
	}));

	let currentTab = $state(navigation[0]);

	setContext(
		'document',
		untrack(() => item),
	);
	setContext(
		'application',
		untrack(() => sheet),
	);
</script>

{#snippet activationConfigTab()}
	<ItemActivationConfigTab></ItemActivationConfigTab>
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
				<h3 class="nimble-heading" data-heading-variant="section">Feature Type</h3>
			</header>

			<TagGroup
				options={featureState.featureTypeOptions}
				selectedOptions={[item.reactive.system.featureType]}
				toggleOption={featureState.updateFeatureType}
			/>
		</div>

		{#if item.reactive.system.featureType === FEATURE_TYPE_CLASS}
			<div>
				<header class="nimble-section-header">
					<h3 class="nimble-heading">Class Identifier</h3>
				</header>

				<input
					type="text"
					value={item.reactive.system.class || ''}
					onchange={({ target }) => item.update({ 'system.class': target.value })}
				/>
			</div>

			<div>
				<header class="nimble-section-header">
					<h3 class="nimble-heading">Group Identifier</h3>
				</header>

				<input
					type="text"
					value={item.reactive.system.group || ''}
					onchange={({ target }) => item.update({ 'system.group': target.value })}
				/>
			</div>

			<div>
				<header class="nimble-section-header">
					<h3 class="nimble-heading">Subclass Feature</h3>
				</header>

				<input
					type="checkbox"
					checked={Boolean(item.reactive.system.subclass)}
					onchange={({ target }) =>
						featureState.updateSubclassFlag((target as HTMLInputElement).checked)}
				/>
			</div>

			<div>
				<header class="nimble-section-header">
					<h3 class="nimble-heading">Gained At Levels</h3>
				</header>

				<input
					type="text"
					value={featureState.gainedAtLevelsInputValue}
					placeholder="e.g. 3 or 2, 6, 9"
					onchange={({ target }) =>
						featureState.updateGainedAtLevels((target as HTMLInputElement).value)}
				/>
			</div>

			<div>
				<header class="nimble-section-header">
					<h3 class="nimble-heading">{localize('NIMBLE.featureSheet.selectionCountByLevel')}</h3>
				</header>

				<input
					type="text"
					value={featureState.selectionCountByLevelInputValue}
					placeholder={localize('NIMBLE.featureSheet.selectionCountByLevelPlaceholder')}
					onchange={({ target }) =>
						featureState.updateSelectionCountByLevel((target as HTMLInputElement).value)}
				/>
			</div>
		{/if}
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

{#snippet rulesTab()}
	<ItemRulesTab></ItemRulesTab>
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
