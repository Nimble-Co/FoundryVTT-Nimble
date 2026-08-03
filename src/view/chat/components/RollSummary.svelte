<script lang="ts">
	import type { RollSummaryProps } from '#types/components/RollSummary.d.ts';

	import { SYSTEM_ID } from '#system';

	const { label, subheading, tooltip, total, options, showRollDetails }: RollSummaryProps =
		$props();
	const { hitDice } = CONFIG.NIMBLE;
	const autoExpand = game.settings.get(SYSTEM_ID, 'autoExpandRolls');
	let expanded = $state(autoExpand);
</script>

<div class="roll" class:roll--no-subheading={!subheading}>
	<div
		class="roll__total"
		data-tooltip={expanded ? null : tooltip}
		data-tooltip-class="nimble-tooltip nimble-tooltip--roll"
		data-tooltip-direction="LEFT"
	>
		{total}
	</div>

	<h3 class="roll__label">{label}</h3>

	{#if tooltip}
		<button
			class="nimble-button roll-expand"
			data-button-variant="icon"
			class:roll-expand--open={expanded}
			aria-label="Toggle dice results"
			onclick={() => (expanded = !expanded)}
		>
			<i class={expanded ? 'fa-solid fa-angle-up' : 'fa-solid fa-angle-down'}></i>
		</button>
	{/if}

	{#if subheading}
		<span class="roll__subheading">
			{subheading}
		</span>
	{/if}
</div>

{#if showRollDetails}
	<div class="roll-details">
		<span>{hitDice.primaryDieValue}: {options.rollOptions.primaryDieValue}</span>
		<span>{hitDice.primaryDieModifier}: {options.rollOptions.primaryDieModifier}</span>
	</div>
{/if}

{#if expanded && tooltip}
	<div class="roll-expanded-details">
		{@html tooltip}
	</div>
{/if}

<style lang="scss">
	.roll-expanded-details {
		margin-top: 0.5rem;
		padding-block-start: 0.5rem;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-sheet-background);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
	}

	.roll-details {
		border-top: 1px solid var(--nimble-card-border-color);
		padding-top: 0.5rem;
		margin-top: 0.5rem;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
		display: flex;
		flex-direction: column;
	}

	.roll {
		display: grid;
		grid-template-areas:
			'rollResult rollLabel expandButton'
			'rollResult subHeading expandButton';
		grid-template-columns: max-content 1fr max-content;
		gap: 0 0.5rem;

		&--no-subheading {
			grid-template-areas: 'rollResult rollLabel expandButton';
		}

		.roll-expand {
			grid-area: expandButton;
			display: flex;
			align-items: center;
			justify-content: center;
			background: none;
			border: none;
			padding: 0;
			cursor: pointer;
			color: var(--nimble-medium-text-color);
			font-size: var(--nimble-sm-text);
			transition: color 0.15s ease;

			&:hover {
				color: var(--nimble-dark-text-color);
			}

			&.roll-expand--open {
				color: var(--nimble-primary-color, var(--nimble-dark-text-color));
			}
		}

		&__label {
			grid-area: rollLabel;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			color: inherit;
			font-size: var(--nimble-sm-text);
			font-weight: 900;
			line-height: 1;
			border: 0;
		}

		&__subheading {
			grid-area: subHeading;
			width: 100%;
			font-size: var(--nimble-xs-text);
			line-height: 1;
			color: var(--nimble-medium-text-color);
			font-weight: 500;
		}

		&__total {
			grid-area: rollResult;
			position: relative;
			display: flex;
			flex-grow: 0;
			align-items: center;
			justify-content: center;
			height: 2.25rem;
			width: 2.5rem;
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}
	}
</style>
