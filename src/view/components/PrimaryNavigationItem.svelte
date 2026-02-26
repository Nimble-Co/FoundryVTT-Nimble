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
		onpointerup={(e) => {
			if (e.button === 0) {
				currentTab = tab;
				// Blur after click so Escape key can close the sheet
				e.target?.blur?.();
			}
		}}
	>
		<i class={tab.icon}></i>
		{localize(tab.label ?? '')}
	</button>
</li>
