<script>
	import SecondaryNavigationItem from './SecondaryNavigationItem.svelte';

	let { currentTab = $bindable(), subNavigation } = $props();
</script>

{#if subNavigation?.length}
	<nav class="nimble-secondary-navigation">
		<ul class="nimble-secondary-navigation-list">
			{#each subNavigation as tab, index}
				{#if tab?.display ?? true}
					<SecondaryNavigationItem bind:currentTab {tab} {index} />
				{/if}
			{/each}
		</ul>
	</nav>
{/if}
