<script lang="ts">
	import type { MovementChip } from './moveNodeText.ts';

	let { chip }: { chip: MovementChip } = $props();
</script>

<span
	class="nimble-movement-chip"
	data-status={chip.status}
	data-tooltip={chip.tooltip}
	aria-label={chip.tooltip}
	role="img"
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
		color: var(--nimble-medium-text-color);
		pointer-events: all;
		background: hsl(41, 18%, 54%, 15%);
		border-radius: 3px;

		i {
			font-size: 0.625rem;
		}

		&[data-status='open'],
		&[data-status='conditional'] {
			color: var(--nimble-dark-text-color);
		}

		&[data-status='taken'],
		&[data-status='partial'] {
			color: var(--nimble-card-text-color);
			background: hsl(120, 40%, 40%, 22%);

			i {
				color: var(--color-level-success, #26b231);
			}
		}

		&[data-status='short'] {
			color: var(--nimble-card-text-color);
			background: hsl(40, 90%, 50%, 22%);

			i {
				color: var(--color-level-warning, #d98a00);
			}
		}

		&[data-status='unused'],
		&[data-status='lapsed'] {
			opacity: 0.75;
		}
	}
</style>
