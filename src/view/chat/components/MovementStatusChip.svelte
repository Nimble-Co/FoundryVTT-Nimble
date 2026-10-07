<script lang="ts">
	import type { MovementStatusChipProps } from '#types/components/MovementStatusChip.d.ts';

	let { chip }: MovementStatusChipProps = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- Foundry shows a tooltip on pointer only, so focus opens it for the keyboard. -->
<span
	class="nimble-movement-chip"
	data-status={chip.status}
	data-tooltip={chip.tooltip}
	aria-label={chip.tooltip}
	role="img"
	tabindex="0"
	onfocus={({ currentTarget }) => game.tooltip.activate(currentTarget)}
	onblur={() => game.tooltip.deactivate()}
>
	<i class="fa-solid {chip.icon}" aria-hidden="true"></i>
	{#if chip.label}<span>{chip.label}</span>{/if}
</span>

<style lang="scss">
	.nimble-movement-chip {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.25rem;
		padding: 0.0625rem 0.3125rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		line-height: 1.2;
		white-space: nowrap;
		color: var(--nimble-dark-text-color);
		pointer-events: all;
		background: var(--nimble-movement-chip-background-color);
		border-radius: 3px;

		i {
			font-size: 0.625rem;
		}

		&[data-status='taken'],
		&[data-status='partial'] {
			color: var(--nimble-movement-chip-done-color);
			background: var(--nimble-movement-chip-done-background-color);
		}

		&[data-status='short'] {
			color: var(--nimble-movement-chip-short-color);
			background: var(--nimble-movement-chip-short-background-color);
		}

		&[data-status='unused'],
		&[data-status='lapsed'] {
			color: var(--nimble-medium-text-color);
		}
	}
</style>
