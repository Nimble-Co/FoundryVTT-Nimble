<script lang="ts">
	import type { DieBonusBadgeProps } from '#types/components/DieBonusBadge.d.ts';

	let { bonus }: DieBonusBadgeProps = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- Foundry shows a tooltip on pointer only, so focus opens it for the keyboard. -->
<span
	class="nimble-die-bonus-badge"
	data-tooltip={bonus.tooltip}
	aria-label={bonus.tooltip}
	role="img"
	tabindex="0"
	onfocus={({ currentTarget }) => game.tooltip.activate(currentTarget)}
	onblur={() => game.tooltip.deactivate()}
>
	{bonus.label}
</span>

<style lang="scss">
	// Sits on the top right corner of the nearest positioned parent, such as a die face.
	.nimble-die-bonus-badge {
		position: absolute;
		top: -0.5rem;
		right: -0.75rem;
		z-index: 1;
		padding: 0 0.25rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		line-height: 0.875rem;
		white-space: nowrap;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-medium-text-color);
		border-radius: 0.375rem;
		pointer-events: all;
	}
</style>
