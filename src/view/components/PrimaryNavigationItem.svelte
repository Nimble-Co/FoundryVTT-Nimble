<script>
	import localize from '../../utils/localize.js';

	let { currentTab = $bindable(), tab } = $props();
</script>

<li class="nimble-primary-navigation-list__item">
	<button
		class="nimble-button"
		data-button-variant="primary-navigation"
		data-button-state={tab.name === currentTab?.name ? 'active' : null}
		type="button"
		aria-label={localize(tab.tooltip)}
		data-tooltip={localize(tab.tooltip)}
		data-tooltip-direction="UP"
		onclick={() => (currentTab = tab)}
	>
		<i class={tab.icon}></i>
		{localize(tab.label ?? '')}
	</button>
</li>
