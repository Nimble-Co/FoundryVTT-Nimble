<script lang="ts">
	import type { ExpandableDocumentItem } from '#types/components/ExpandableDocumentList.d.ts';

	import ExpandableDocumentList from '#view/components/ExpandableDocumentList.svelte';
	import localize from '#utils/localize.js';

	interface Props {
		epicBoons: ExpandableDocumentItem[];
		selectedEpicBoon: ExpandableDocumentItem | null;
	}

	let { epicBoons, selectedEpicBoon = $bindable() }: Props = $props();
</script>

<section class="epic-boon-selection">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.epicBoonSelection.header')}
		</h3>
		<p class="nimble-hint">{localize('NIMBLE.epicBoonSelection.hint')}</p>
	</header>

	{#if epicBoons.length > 0}
		<ExpandableDocumentList
			items={epicBoons}
			bind:selectedItem={selectedEpicBoon}
			selectTooltip={localize('NIMBLE.epicBoonSelection.selectBoon')}
			deselectTooltip={localize('NIMBLE.epicBoonSelection.deselectBoon')}
			selectAriaLabel={(name) =>
				localize('NIMBLE.epicBoonSelection.selectBoonAriaLabel', { boonName: name })}
			deselectAriaLabel={(name) =>
				localize('NIMBLE.epicBoonSelection.deselectBoonAriaLabel', { boonName: name })}
		/>
	{:else}
		<p class="nimble-hint">
			{localize('NIMBLE.epicBoonSelection.noBoons')}
		</p>
	{/if}
</section>

<style lang="scss">
	.epic-boon-selection {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 0.5rem 0;
		}

		.nimble-hint {
			margin: 0 0 1rem 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
