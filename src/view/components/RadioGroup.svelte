<script lang="ts">
	interface Props {
		disabled?: boolean;
		options: [string, string][];
		selected: string | number;
		toggleOption: (newValue: string | number) => Promise<void>;
	}

	let { disabled = false, options, selected, toggleOption }: Props = $props();
</script>

{#snippet tag([value, label]: [string, string])}
	{@const isSelected = value == selected}

	<li class="nimble-radio-group__option">
		<button
			class="nimble-radio-group__option-button"
			class:nimble-radio-group__option-button--selected={isSelected}
			disabled={!isSelected && disabled}
			type="button"
			onclick={() => toggleOption(value)}
		>
			{label}
		</button>
	</li>
{/snippet}

<ul class="nimble-radio-group">
	{#each options as option}
		{@render tag(option)}
	{/each}
</ul>

<style lang="scss">
	.nimble-radio-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nimble-radio-group-gap, 0.25rem);
		margin: var(--nimble-radio-group-margin, 0);
		padding: var(--nimble-radio-group-padding, 0);
		list-style: none;
		color: var(--nimble-tag-text-color, var(--nimble-dark-text-color));

		&__option {
			display: contents;
		}

		&__option-button {
			display: flex;
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
				--nimble-tag-background-color: var(--nimble-navigation-background-color);

				background: var(--nimble-tag-background-color);
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
				--nimble-tag-background-color: var(--nimble-navigation-background-color);

				background: var(--nimble-tag-background-color);
				color: var(--nimble-hover-tag-text-color, var(--nimble-light-text-color));
			}
		}
	}
</style>
