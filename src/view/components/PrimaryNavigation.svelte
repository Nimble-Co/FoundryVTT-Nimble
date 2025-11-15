<script>
	import localize from '../../utils/localize';

	import PrimaryNavigationItem from './PrimaryNavigationItem.svelte';

	let { currentTab = $bindable(), navigation, condenseNavigation = false } = $props();
</script>

<nav
	class="nimble-primary-navigation"
	class:nimble-primary-navigation--condense-navigation={condenseNavigation}
>
	<!-- This allows us to reserve enough space for the largest tab name -->
	{#each navigation as { name, tooltip }}
		<span
			class="nimble-primary-navigation__current-tab-label"
			class:nimble-primary-navigation__current-tab-label--active={name === currentTab?.name}
		>
			{localize(tooltip)}
		</span>
	{/each}

	<ul class="nimble-primary-navigation-list">
		{#each navigation as tab}
			{#if tab.display ?? true}
				<PrimaryNavigationItem bind:currentTab {tab} />
			{/if}
		{/each}
	</ul>
</nav>
