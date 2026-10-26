<script lang="ts">
	import type { RerollHistoryProps } from '#types/components/RerollHistory.d.ts';

	import DieFace from '../../components/DieFace.svelte';

	let { legacyLines, lines }: RerollHistoryProps = $props();
</script>

{#each legacyLines as line (line.id)}
	<div class="nimble-roll-changes__history">
		<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
		<p>{line.text}</p>
	</div>
{/each}

{#each lines as line, index (index)}
	<div class="nimble-roll-changes__history nimble-roll-changes__history--reroll">
		<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
		<div class="nimble-roll-changes__text">
			<p>{line.text}</p>
			{#if line.detail}
				<p class="nimble-roll-changes__detail">{line.detail}</p>
			{/if}
		</div>
		{#if line.dice}
			<span class="nimble-roll-changes__dice">
				<DieFace {...line.dice.previous} discarded />
				<i class="nimble-roll-changes__arrow fa-solid fa-arrow-right" aria-hidden="true"></i>
				<DieFace {...line.dice.next} />
			</span>
		{/if}
	</div>
{/each}

<style lang="scss">
	.nimble-roll-changes {
		&__history {
			display: flex;
			align-items: flex-start;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);

			> i {
				margin-top: 0.125rem;
			}

			p {
				margin: 0;
				text-wrap: pretty;
			}
		}

		&__history--reroll {
			align-items: center;
			gap: 0.25rem;

			> i {
				align-self: flex-start;
			}
		}

		&__text {
			flex: 1;
			min-width: 0;
		}

		&__dice {
			display: flex;
			flex: none;
			align-items: center;
			gap: 0.25rem;
		}

		&__arrow {
			font-size: 0.625rem;
			color: var(--nimble-medium-text-color);
		}

		&__detail {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
