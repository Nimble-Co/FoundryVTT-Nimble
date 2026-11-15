<script lang="ts">
	import type { MigrationProgressBarProps } from './MigrationProgressBar.types.ts';
	import { progressWord } from './worldMigrationWords.js';

	let { progress }: MigrationProgressBarProps = $props();

	const filledPercent = $derived(progress.total > 0 ? (progress.done / progress.total) * 100 : 0);
</script>

<div class="nimble-world-migration__progress">
	<div
		class="nimble-world-migration__well"
		role="progressbar"
		aria-valuemin="0"
		aria-valuemax={progress.total}
		aria-valuenow={progress.done}
	>
		<div class="nimble-world-migration__fill" style:width="{filledPercent}%"></div>
		<span>{progressWord('count', { done: progress.done, total: progress.total })}</span>
	</div>
	<p class="nimble-world-migration__meta">
		{progressWord(progress.part)}. {progressWord('keepOpen')}
	</p>
</div>

<style lang="scss">
	.nimble-world-migration {
		&__progress {
			// The crimson shades of the fill gradient. No theme variable has them.
			--nimble-world-migration-fill-highlight: hsl(1, 55%, 42%);
			--nimble-world-migration-fill-shade: hsl(1, 52%, 24%);

			display: flex;
			flex-direction: column;
			gap: 0.3rem;

			p {
				margin: 0;
			}
		}

		&__meta {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}

		&__well {
			position: relative;
			height: 1.375rem;
			overflow: hidden;
			background: var(--nimble-hp-bar-background);
			border: 1px solid var(--nimble-resource-bar-border-color);
			border-radius: 4px;

			span {
				position: absolute;
				inset: 0;
				display: grid;
				place-items: center;
				font-size: var(--nimble-xs-text);
				font-weight: 700;
				font-variant-numeric: tabular-nums;
				color: var(--nimble-parchment);
				text-shadow: 0 1px 2px var(--nimble-resource-bar-shadow-color);
			}
		}

		&__fill {
			position: absolute;
			inset: 0 auto 0 0;
			background: linear-gradient(
				180deg,
				var(--nimble-world-migration-fill-highlight),
				var(--nimble-crimson) 60%,
				var(--nimble-world-migration-fill-shade)
			);
			box-shadow: 0 0 6px var(--nimble-resource-bar-shadow-color);
			transition: width 0.25s ease-in-out;

			@media (prefers-reduced-motion: reduce) {
				transition: none;
			}
		}
	}
</style>
