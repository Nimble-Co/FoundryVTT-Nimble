<script lang="ts">
	import localize from '#utils/localize.js';
	import { createRuleTypePickerState } from '#view/rulesBuilder/components/RuleTypePicker.svelte.js';
	import type { RuleTypePickerProps } from '#view/rulesBuilder/types.js';

	let { onPick, disabled = false, forEffect = false }: RuleTypePickerProps = $props();

	const state = createRuleTypePickerState(() => forEffect);
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
			gap: 6px;
			padding: 0 0 6px;
		}

		&__group-header {
			display: flex;
			gap: 0.375rem;
			align-items: center;
			padding-bottom: 5px;
			font-size: 0.688rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--nimble-ui-ink-dim);
			border-bottom: 1px solid var(--nimble-ui-soft);
		}

		&__group-count {
			margin-left: auto;
			padding: 0 0.375rem;
			font-size: 0.688rem;
			font-weight: 700;
			letter-spacing: 0;
			color: var(--nimble-ui-ink-muted);
		}

		&__cards {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
			gap: 0.25rem;
		}

		&__card {
			display: flex;
			gap: 7px;
			align-items: center;
			padding: 0 10px;
			min-height: 28px;
			background: none;
			color: var(--nimble-ui-ink);
			text-align: left;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			font-weight: 700;
			cursor: pointer;
			overflow: hidden;
			transition:
				background-color 100ms ease,
				border-color 100ms ease;

			&:hover,
			&:focus {
				background: var(--nimble-ui-hover);
				border-color: var(--nimble-ui-highlight);
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
			color: var(--nimble-ui-ink-dim);
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
