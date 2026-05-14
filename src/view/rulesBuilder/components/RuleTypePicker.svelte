<script lang="ts">
	import localize from '#utils/localize.js';
	import { createRuleTypePickerState } from '#view/rulesBuilder/components/RuleTypePicker.svelte.js';
	import type { RuleTypePickerProps } from '#view/rulesBuilder/types.js';

	let { onPick, disabled = false }: RuleTypePickerProps = $props();

	const state = createRuleTypePickerState();
	state.setupDevWarningsEffect();
</script>

<div class="nimble-rule-type-picker">
	{#each state.groupedEntries as { group, meta, entries } (group)}
		<section class="nimble-rule-type-picker__group">
			<header class="nimble-rule-type-picker__group-header">
				<i class={meta.icon} aria-hidden="true"></i>
				<span>{meta.label}</span>
				<span class="nimble-rule-type-picker__group-count">{entries.length}</span>
			</header>

			<div class="nimble-rule-type-picker__cards">
				{#each entries as entry (entry.key)}
					<button
						type="button"
						class="nimble-rule-type-picker__card"
						class:nimble-rule-type-picker__card--warn={entry.hasDevWarning}
						data-tooltip={entry.hasDevWarning
							? localize('NIMBLE.rulesBuilder.pickerMissingMetaTooltip')
							: entry.description}
						data-tooltip-direction="UP"
						{disabled}
						onclick={() => onPick(entry.key)}
					>
						<i class="nimble-rule-type-picker__card-icon {entry.icon}" aria-hidden="true"></i>
						<span class="nimble-rule-type-picker__card-label">{entry.label}</span>
						{#if entry.hasDevWarning}
							<i
								class="fa-solid fa-triangle-exclamation nimble-rule-type-picker__card-warn"
								aria-hidden="true"
							></i>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style lang="scss">
	.nimble-rule-type-picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__group {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			padding: 0.375rem 0.5rem 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid hsla(41, 18%, 54%, 25%);
			border-radius: 6px;
		}

		&__group-header {
			display: flex;
			gap: 0.375rem;
			align-items: center;
			padding-bottom: 0.125rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--color-text-dark-secondary);
			border-bottom: 1px solid hsla(41, 18%, 54%, 15%);

			i {
				color: var(--nimble-accent-color);
			}
		}

		&__group-count {
			margin-left: auto;
			padding: 0 0.375rem;
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			background: var(--nimble-sheet-background, transparent);
			border-radius: 999px;
		}

		&__cards {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
			gap: 0.25rem;
		}

		&__card {
			display: flex;
			gap: 0.375rem;
			align-items: center;
			padding: 0.25rem 0.5rem;
			min-height: 1.75rem;
			background: var(--nimble-sheet-background);
			color: inherit;
			text-align: left;
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;
			cursor: pointer;
			overflow: hidden;
			transition:
				background-color 100ms ease,
				border-color 100ms ease;

			&:hover,
			&:focus {
				background: var(--nimble-selected-tag-background-color);
				color: var(--nimble-selected-tag-text-color, var(--nimble-light-text-color));
				outline: none;
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			&--warn {
				border-color: var(--color-level-warning, gold);
			}
		}

		&__card-icon {
			width: 0.875rem;
			text-align: center;
			color: var(--nimble-accent-color);
			flex-shrink: 0;
		}

		&__card-label {
			font-size: var(--nimble-sm-text);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			flex-grow: 1;
			min-width: 0;
		}

		&__card-warn {
			color: var(--color-level-warning, gold);
			font-size: var(--nimble-xs-text);
			flex-shrink: 0;
		}
	}
</style>
