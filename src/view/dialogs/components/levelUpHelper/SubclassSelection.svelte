<script lang="ts">
	import type { ExpandableDocumentItem } from '#types/components/ExpandableDocumentList.d.ts';

	import ExpandableDocumentList from '#view/components/ExpandableDocumentList.svelte';
	import localize from '#utils/localize.js';

	interface Props {
		subclasses: ExpandableDocumentItem[];
		selectedSubclass: ExpandableDocumentItem | null;
	}

	let { subclasses, selectedSubclass = $bindable() }: Props = $props();
</script>

<section class="subclass-selection">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">Subclass</h3>
	</header>

	{#if subclasses.length > 0}
		<ExpandableDocumentList
			items={subclasses}
			bind:selectedItem={selectedSubclass}
			selectTooltip={localize('NIMBLE.subclassSelection.selectSubclass')}
			deselectTooltip={localize('NIMBLE.subclassSelection.deselectSubclass')}
			selectAriaLabel={(name) =>
				localize('NIMBLE.subclassSelection.selectSubclassAriaLabel', { subclassName: name })}
			deselectAriaLabel={(name) =>
				localize('NIMBLE.subclassSelection.deselectSubclassAriaLabel', { subclassName: name })}
		/>
	{:else}
		<p class="nimble-hint">
			No subclasses available for this class. You may need to create or import subclass items.
		</p>
	{/if}
</section>

<style lang="scss">
	.subclass-selection {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 1rem 0;
		}
	}
</style>
