<script lang="ts">
	import type { SelectionIndicatorProps } from '#types/components/SelectionIndicator.d.ts';

	let {
		selected,
		onclick,
		tooltip,
		ariaLabel,
		disabled = false,
	}: SelectionIndicatorProps = $props();
</script>

<button
	type="button"
	class="select-button"
	class:selected
	{onclick}
	{disabled}
	data-tooltip={tooltip}
	data-tooltip-direction="LEFT"
	aria-label={ariaLabel}
>
	{#if selected}
		<i class="fa-solid fa-check"></i>
	{/if}
</button>

<style lang="scss">
	.select-button {
		width: 1.25rem;
		min-width: 1.25rem;
		max-width: 1.25rem;
		height: 1.25rem;
		min-height: 1.25rem;
		max-height: 1.25rem;
		padding: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--nimble-medium-text-color) 15%, transparent);
		border: 2px solid color-mix(in srgb, var(--nimble-medium-text-color) 60%, transparent);
		border-radius: 50%;
		box-sizing: border-box;
		color: transparent;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover:not(:disabled) {
			border-color: color-mix(in srgb, var(--nimble-medium-text-color) 80%, transparent);
			background: color-mix(in srgb, var(--nimble-medium-text-color) 35%, transparent);
		}

		&.selected {
			background: var(--nimble-accent-color);
			border-color: var(--nimble-accent-color);
			color: #fff;

			&:hover:not(:disabled) {
				filter: brightness(1.15);
			}
		}

		&:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		i {
			font-size: 0.625rem;
		}
	}
</style>
