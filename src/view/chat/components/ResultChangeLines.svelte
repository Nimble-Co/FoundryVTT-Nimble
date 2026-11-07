<script lang="ts">
	import type { ResultChangeLinesProps } from '#types/components/ResultChangeLines.d.ts';

	import localize from '#utils/localize.js';

	let { sum = null, lines, held, onremove }: ResultChangeLinesProps = $props();
</script>

{#if sum}
	<p class="nimble-result-sum">{sum}</p>
{/if}

{#each lines as line (line.id)}
	<div class="nimble-result-line" class:nimble-result-line--retired={line.retired}>
		<p class="nimble-result-line__text">
			<span class="nimble-result-line__verb">{line.verb}</span>
			<span class="nimble-result-line__feature">{line.withFeature}</span>
			{#if line.detail}
				<span class="nimble-result-line__detail">{line.detail}</span>
			{/if}
			{#if line.note}
				<span class="nimble-result-line__note">{line.note}</span>
			{/if}
		</p>
		{#if line.canRemove}
			<button
				class="nimble-result-line__remove"
				type="button"
				aria-label={localize('NIMBLE.chat.incomingReactions.resultChange.removeLine', {
					line: line.sentence,
				})}
				disabled={held.has(line.id)}
				onclick={() => onremove(line)}
			>
				{localize('NIMBLE.chat.incomingReactions.resultChange.remove')}
			</button>
		{/if}
	</div>
{/each}

<style lang="scss">
	// The look of the formula in the roll windows.
	.nimble-result-sum {
		margin: 0;
		padding: 6px;
		border-radius: 4px;
		background: var(--nimble-ui-well);
		text-align: center;
		font: 600 0.812rem/1.2 var(--nimble-mono-font);
	}

	.nimble-result-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		&__text {
			flex: 1;
			min-width: 0;
			margin: 0;
			font-size: var(--nimble-sm-text);
			text-wrap: pretty;
		}

		&__verb {
			font-weight: 800;
		}

		&__feature,
		&__detail,
		&__note {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__detail,
		&__note {
			display: block;
		}

		&--retired &__verb {
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__remove {
			flex: none;
			width: auto;
			height: auto;
			min-height: 24px;
			margin: 0;
			padding: 0.125rem 0.5rem;
			font-family: var(--nimble-primary-font);
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			line-height: 1.2;
			color: inherit;
			background: transparent;
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 3px;
			box-shadow: none;
			cursor: pointer;

			&:hover:not(:disabled) {
				color: inherit;
				background: var(--nimble-card-border-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}
		}
	}
</style>
