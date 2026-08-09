<script lang="ts">
	import type { SpellScrollChoiceCardProps } from '#types/components/SpellScrollDialog.d.ts';

	let {
		name,
		value,
		group = $bindable(),
		icon,
		title,
		hint,
		children,
	}: SpellScrollChoiceCardProps = $props();
</script>

<!--
	Mirrors .rest-type-card in FieldRestDialog.svelte, the house pattern for a
	choice in a dialog: the native radio is hidden, the whole label is the control,
	and a corner dot marks the selection.

	The input is hidden, not removed — the label still needs a real radio for
	keyboard traversal and arrow-key group navigation.
-->
<label
	class="nimble-spell-scroll-choice"
	class:nimble-spell-scroll-choice--selected={group === value}
>
	<input class="nimble-spell-scroll-choice__input" type="radio" {name} {value} bind:group />

	<span class="nimble-spell-scroll-choice__header">
		<i class="nimble-spell-scroll-choice__icon fa-solid {icon}"></i>
		<span class="nimble-spell-scroll-choice__title">{title}</span>
	</span>

	<span class="nimble-spell-scroll-choice__hint">{hint}</span>

	{@render children?.()}

	<span class="nimble-spell-scroll-choice__indicator"></span>
</label>

<style lang="scss">
	.nimble-spell-scroll-choice {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover:not(&--selected) {
			border-color: var(--nimble-accent-color);
		}

		// The radio is the focusable element but is invisible, so the ring has to be
		// drawn on the label instead. Matches the treatment on .nimble-size-choice__option.
		&:has(.nimble-spell-scroll-choice__input:focus-visible) {
			border-color: var(--nimble-accent-color);
			box-shadow: 0 0 0 1px var(--nimble-accent-color);
		}

		&--selected {
			background: var(--nimble-choice-card-selected-background);
			border-color: var(--nimble-choice-card-selected-border-color);
			box-shadow: inset 0 0 0 1px var(--nimble-choice-card-selected-border-color);
		}

		&__input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		&__indicator {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			width: 0.625rem;
			height: 0.625rem;
			background: transparent;
			border: 2px solid transparent;
			border-radius: 50%;
			transition: var(--nimble-standard-transition);

			.nimble-spell-scroll-choice--selected & {
				background: var(--nimble-choice-card-selected-icon-color);
				border-color: var(--nimble-choice-card-selected-border-color);
			}
		}

		&__header {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			// Leave room for the indicator dot.
			padding-inline-end: 1rem;
		}

		&__icon {
			flex-shrink: 0;
			font-size: var(--nimble-md-text);
			color: var(--nimble-medium-text-color);
			transition: var(--nimble-standard-transition);

			.nimble-spell-scroll-choice--selected & {
				color: var(--nimble-choice-card-selected-icon-color);
			}
		}

		&__title {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			transition: var(--nimble-standard-transition);

			.nimble-spell-scroll-choice--selected & {
				color: var(--nimble-choice-card-selected-text-color);
			}
		}

		&__hint {
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			line-height: 1.45;
			color: var(--nimble-dark-text-color);
		}
	}
</style>
