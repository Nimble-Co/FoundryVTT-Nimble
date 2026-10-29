<!--
@component
A button with a frame. `secondary` is the outlined button (Cancel, Delete, Expand all). `primary` is the crimson button
that ends a window (Roll, Close, Save Changes); it fills the width that it gets.
`size="sm"` is 26 px high. `iconOnly` is a 32 px square: give it `ariaLabel`.
-->
<script lang="ts">
	import type { ButtonProps } from '#types/components/actorSheets/Button.d.ts';

	let {
		variant = 'secondary',
		icon,
		label,
		size = 'md',
		iconOnly = false,
		ariaLabel,
		pressed,
		tooltip,
		disabled = false,
		autofocus = false,
		onclick,
	}: ButtonProps = $props();
</script>

<button
	type="button"
	class="nimble-u-reset-button btn {variant}"
	class:sm={size === 'sm' && !iconOnly}
	class:icon-only={iconOnly}
	aria-label={ariaLabel}
	aria-pressed={pressed}
	aria-disabled={disabled || undefined}
	data-tooltip={tooltip}
	data-autofocus={autofocus || undefined}
	onclick={disabled ? undefined : onclick}
>
	{#if icon}<i class={icon}></i>{/if}
	{#if !iconOnly}{label}{/if}
</button>

<style>
	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		border-radius: 4px;
		font-weight: 700;
		white-space: nowrap;
		font-family: var(--nimble-primary-font);
	}
	.secondary {
		flex: none;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--nimble-ui-ring);
		font-size: 0.857rem;
		color: var(--nimble-ui-ink);
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.secondary:hover,
	.secondary[aria-pressed='true'] {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.secondary i {
		font-size: 0.786rem;
	}
	.secondary[aria-disabled='true'] {
		border-style: dashed;
		color: var(--nimble-ui-ink-muted);
		background: none;
		cursor: default;
	}
	.primary {
		flex: 1;
		height: 34px;
		background: var(--nimble-crimson);
		font-size: 1rem;
		color: #fff;
	}
	.primary:hover {
		filter: brightness(1.15);
	}
	.primary[aria-disabled='true'] {
		background: var(--nimble-ui-soft);
		color: var(--nimble-ui-ink-muted);
		cursor: default;
		filter: none;
	}
	.sm {
		height: 26px;
		padding: 0 9px;
		gap: 6px;
	}
	.icon-only {
		width: 32px;
		height: 32px;
		padding: 0;
	}
</style>
