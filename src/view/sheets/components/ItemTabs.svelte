<!--
@component
The tabs of an item window: the sheet tab bar (`SheetTabs`) for a `navigation` list of `{ name, tooltip, icon, component }`.
-->
<script lang="ts">
	import type { ItemTabsProps } from '#types/components/ItemTabs.d.ts';
	import localize from '#utils/localize.js';
	import SheetTabs from '#view/actorSheets/parts/SheetTabs.svelte';

	let { currentTab = $bindable(), navigation }: ItemTabsProps = $props();

	const shown = $derived(navigation.filter((tab) => tab.display ?? true));
	const tabs = $derived(
		shown.map((tab) => ({ id: tab.name, label: localize(tab.tooltip), icon: tab.icon })),
	);
</script>

<div class="item-tabs" data-tab-count={tabs.length}>
	<SheetTabs
		{tabs}
		value={currentTab?.name}
		fit="inline"
		onchange={(id) => {
			currentTab = shown.find((tab) => tab.name === id) ?? currentTab;
		}}
	/>
</div>

<style lang="scss">
	// Each tab needs about this much room to show its icon and label side by side.
	$tab-room: 4.75rem;

	.item-tabs {
		container: item-tabs / inline-size;
		grid-area: primaryNavigation;
		position: relative;
		z-index: 3;
		margin-top: 8px;
		padding: 0 6px;
		border-bottom: 1px solid var(--nimble-ui-line);

		:global(.t) {
			padding-inline: 2px;
		}

		:global(.t > i) {
			flex: 0 0 auto;
		}

		// A long label that still does not fit ends with an ellipsis, it never runs into the next tab.
		:global(.tl) {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	// Too narrow for the labels: only the icons show. The label stays as the tooltip and the accessible name.
	@for $count from 2 through 8 {
		@container item-tabs (max-width: #{$count * $tab-room}) {
			.item-tabs[data-tab-count='#{$count}'] :global(.tl) {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
			}
		}
	}
</style>
