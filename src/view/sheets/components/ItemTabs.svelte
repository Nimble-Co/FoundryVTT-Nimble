<!--
@component
The tabs of an item window: the sheet tab bar (`SheetTabs`) for a `navigation` list of `{ name, tooltip, icon, component }`.
-->
<script lang="ts">
	import localize from '#utils/localize.js';
	import SheetTabs from '#view/actorSheets/parts/SheetTabs.svelte';

	interface NavigationTab {
		name: string;
		tooltip: string;
		icon: string;
		display?: boolean;
	}

	let {
		currentTab = $bindable(),
		navigation,
	}: { currentTab: NavigationTab; navigation: NavigationTab[] } = $props();

	const shown = $derived(navigation.filter((tab) => tab.display ?? true));
	const tabs = $derived(
		shown.map((tab) => ({ id: tab.name, label: localize(tab.tooltip), icon: tab.icon })),
	);
</script>

<div class="item-tabs">
	<SheetTabs
		{tabs}
		value={currentTab?.name}
		fit="inline"
		onchange={(id) => {
			currentTab = shown.find((tab) => tab.name === id) ?? currentTab;
		}}
	/>
</div>

<style>
	.item-tabs {
		grid-area: primaryNavigation;
		position: relative;
		z-index: 3;
		margin-top: 8px;
		padding: 0 6px;
		border-bottom: 1px solid var(--nimble-ui-line);
	}
</style>
