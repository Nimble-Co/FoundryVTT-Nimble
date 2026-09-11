<script lang="ts">
	import type { OptionChangesListProps } from '#types/components/OptionChangesList.d.ts';

	import localize from '#utils/localize.js';

	let { changes }: OptionChangesListProps = $props();
</script>

{#if changes.length > 0}
	<div class="option-changes">
		<h4 class="option-changes__heading">{localize('NIMBLE.optionSwap.cardHeading')}</h4>

		{#each changes as change}
			<div class="option-changes__row">
				<i class="option-changes__icon fa-solid fa-arrow-right-arrow-left"></i>
				<span class="option-changes__label">{change.label}</span>
				<span class="option-changes__value">
					{#each change.removed as name}
						<span class="option-changes__removed">{name}</span>
					{/each}
					{#if change.removed.length > 0 && change.added.length > 0}
						<i class="fa-solid fa-arrow-right option-changes__arrow"></i>
					{/if}
					{#each change.added as name}
						<span class="option-changes__added">{name}</span>
					{/each}
				</span>
			</div>
		{/each}
	</div>
{/if}

<style lang="scss">
	.option-changes {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--nimble-card-border-color);
	}

	.option-changes__heading {
		margin: 0;
		font-size: var(--nimble-sm-text, 0.75rem);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		opacity: 0.75;
	}

	.option-changes__row {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		font-size: var(--nimble-sm-text, 0.75rem);
	}

	.option-changes__icon {
		opacity: 0.6;
	}

	.option-changes__label {
		font-weight: 600;
	}

	.option-changes__value {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem;
		margin-left: auto;
		text-align: right;
	}

	.option-changes__removed {
		text-decoration: line-through;
		opacity: 0.65;
	}

	.option-changes__added {
		font-weight: 600;
	}

	.option-changes__arrow {
		font-size: 0.625em;
		opacity: 0.5;
	}
</style>
