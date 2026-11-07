<script lang="ts">
	import type { AncestryBonusSheetProps } from '#types/components/AncestryBonusSheet.d.ts';

	import { setContext, untrack } from 'svelte';
	import localize from '../../utils/localize.js';
	import ItemTabs from './components/ItemTabs.svelte';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import Editor from './components/Editor.svelte';
	import ItemHeader from './components/ItemHeader.svelte';
	import ItemRulesTab from './pages/ItemRulesTab.svelte';

	const navigation = [
		{
			component: descriptionTab,
			icon: 'fa-solid fa-file-lines',
			tooltip: 'NIMBLE.ancestryBonusSheet.descriptionTab',
			name: 'description',
		},
		{
			component: configTab,
			icon: 'fa-solid fa-gears',
			tooltip: 'NIMBLE.ancestryBonusSheet.configTab',
			name: 'config',
		},
		{
			component: rulesTab,
			icon: 'fa-solid fa-bolt',
			tooltip: 'NIMBLE.ancestryBonusSheet.rulesTab',
			name: 'rules',
		},
	];

	let { item, sheet }: AncestryBonusSheetProps = $props();
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

{#snippet descriptionTab()}
	<section class="nimble-sheet__body nimble-sheet__body--item">
		{#key item.reactive.system.description}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ancestryBonusSheet.description')}
				</h3>
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
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ancestryBonusSheet.identifier')}
				</h3>
			</header>

			<input
				type="text"
				value={item.reactive.identifier || ''}
				onchange={({ target }) =>
					item.update({ 'system.identifier': (target as HTMLInputElement).value } as Record<
						string,
						unknown
					>)}
			/>
		</div>
	</section>
{/snippet}

<!-- Wrapped rather than listed as a component so every navigation entry is a Snippet;
     a mixed array widens `component` to a union `{@render}` won't accept. -->
{#snippet rulesTab()}
	<ItemRulesTab />
{/snippet}

<header class="nimble-sheet__header nimble-window__head">
	<WindowHead
		img={item.reactive.img ?? undefined}
		tileLabel={localize('NIMBLE.prompts.changeAncestryBonusImage')}
		ontile={(event) => updateDocumentImage(item, { shiftKey: event.shiftKey })}
	>
		{#snippet name()}<ItemHeader
				{item}
				placeholder={localize('NIMBLE.ancestryBonusSheet.namePlaceholder')}
			/>{/snippet}
	</WindowHead>
</header>

<ItemTabs bind:currentTab {navigation} />

{@render currentTab.component()}
