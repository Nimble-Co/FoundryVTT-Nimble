<script lang="ts">
	import type { TagGroupOption } from '#types/tagGroupOption.js';

	interface props {
		disabled?: boolean;
		grid?: boolean;
		options: TagGroupOption[];
		selectedOptions: (string | number)[] | Set<string | number>;
		toggleOption: (newValue: string | number) => Promise<void>;
	}

	let { disabled = false, grid = false, options, selectedOptions, toggleOption }: props = $props();
</script>

{#snippet tag(option: TagGroupOption)}
	{@const selected =
		selectedOptions instanceof Set
			? selectedOptions?.has?.(option.value)
			: selectedOptions?.includes?.(option.value)}

	<li class="nimble-tag-group__option">
		<button
			class="nimble-tag-group__option-button"
			class:nimble-tag-group__option-button--selected={selected}
			data-tooltip={option.tooltip}
			data-tooltip-direction="UP"
			disabled={!selected && disabled}
			type="button"
			onclick={(event) => toggleOption(option.value, event)}
		>
			{#if option.icon}
				<i class={option.icon}></i>
			{/if}

			{option.label}
		</button>
	</li>
{/snippet}

<ul class="nimble-tag-group" class:nimble-tag-group--grid={grid}>
	{#each options as option}
		{@render tag(option)}
	{/each}
</ul>

<style lang="scss">
	.nimble-tag-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nimble-tag-group-gap, 0.25rem);
		margin: var(--nimble-tag-group-margin, 0);
		padding: var(--nimble-tag-group-padding, 0);
		list-style: none;
		color: var(--nimble-tag-text-color, var(--nimble-dark-text-color));

		&--grid {
			display: grid;
			grid-template-columns: var(--nimble-tag-group-grid-columns);

			--nimble-tag-width: 100%;
		}

		&__option {
			display: contents;
		}

		&__option-button {
			display: flex;
			gap: var(--nimble-tag-gap, 0.25rem);
			flex-grow: var(--nimble-tag-grow, 0);
			width: var(--nimble-tag-width, fit-content);
			margin: 0;
			padding: var(--nimble-tag-padding, 0.25rem 0.375rem);
			font-size: var(--nimble-xs-text);
			line-height: 1;
			color: inherit;
			background: var(--nimble-tag-background-color, var(--nimble-box-background-color));
			border: var(--nimble-tag-border, 1px solid var(--nimble-accent-color));
			border-radius: var(--nimble-tag-border-radius, 4px);
			transition: var(--nimble-standard-transition);

			&--selected {
				--nimble-tag-background-color: var(--nimble-selected-tag-background-color);

				color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
			}

			&:active,
			&:focus,
			&:hover {
				border: var(--nimble-hover-tag-border, 1px solid var(--nimble-accent-color));
				box-shadow: none;
				outline: none;
			}

			&:hover {
				--nimble-tag-background-color: var(--nimble-selected-tag-background-color);

				background: var(--nimble-tag-background-color);
				color: var(--nimble-hover-tag-text-color, var(--nimble-light-text-color));
			}
		}
	}
</style>
