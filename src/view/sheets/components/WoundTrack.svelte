<script lang="ts">
	import localize from '#utils/localize.js';

	interface Props {
		currentWounds: number;
		maxWounds: number;
		toggleWound: (woundLevel: number) => void;
	}

	let { currentWounds, maxWounds, toggleWound }: Props = $props();

	const segmentCount = $derived(Math.max(0, maxWounds));
</script>

{#if segmentCount > 0}
	<div class="nimble-wound-track">
		<div class="nimble-wound-track__segments">
			{#each { length: segmentCount }, index}
				{@const woundLevel = index + 1}
				{@const isFilled = currentWounds >= woundLevel}
				<button
					class="nimble-wound-track__segment"
					class:nimble-wound-track__segment--filled={isFilled}
					type="button"
					aria-pressed={isFilled}
					aria-label={localize('NIMBLE.wounds.toggle', { level: String(woundLevel) })}
					data-tooltip={localize('NIMBLE.wounds.toggle', { level: String(woundLevel) })}
					onclick={() => toggleWound(woundLevel)}
				></button>
			{/each}
		</div>

		<div class="nimble-heading nimble-heading--wounds">
			{localize('NIMBLE.wounds.heading')}
			<i class="fa-solid fa-droplet"></i>
			<span
				class="nimble-wound-track__count"
				class:nimble-wound-track__count--wounded={currentWounds > 0}
			>
				{currentWounds}/{segmentCount}
			</span>
		</div>
	</div>
{/if}

<style lang="scss">
	.nimble-wound-track {
		grid-area: woundTrack;
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
		margin-block: 0.375rem 0.75rem;

		&__segments {
			display: flex;
			gap: 2px;
		}

		&__segment {
			--button-size: auto;
			// Drawn as an inset ring rather than a real border so the 7px bar keeps its height.
			--nimble-wound-track-segment-ring: inset 0 0 0 1px var(--nimble-wound-track-border-color);

			position: relative;
			flex: 1;
			height: 0.4375rem;
			min-width: 0;
			margin: 0;
			padding: 0;
			border: 0;
			border-radius: 2px;
			background: var(--nimble-wound-track-empty-background);
			box-shadow: var(--nimble-wound-track-segment-ring), var(--nimble-wound-track-inset-shadow);
			transition: var(--nimble-standard-transition);
			cursor: pointer;

			// Widens the pointer target beyond the 7px bar without affecting layout.
			&::after {
				content: '';
				position: absolute;
				inset: -0.3125rem 0;
			}

			// Hovering segment N previews the resulting total by lighting 1..N.
			&:hover,
			&:focus-visible,
			&:has(~ .nimble-wound-track__segment:hover),
			&:has(~ .nimble-wound-track__segment:focus-visible) {
				background: var(--nimble-wound-track-preview-background);
				box-shadow: var(--nimble-wound-track-segment-ring), var(--nimble-wound-track-inset-shadow);
			}

			// Pointer focus only: the keyboard ring is restored below.
			&:focus {
				outline: none;
			}

			&:focus-visible {
				outline: 1px solid var(--nimble-wound-track-focus-outline-color);
				outline-offset: 1px;
			}

			// Must stay after the preview rule: equal specificity, so source order wins.
			&--filled,
			&--filled:hover,
			&--filled:focus-visible,
			&--filled:has(~ .nimble-wound-track__segment:hover),
			&--filled:has(~ .nimble-wound-track__segment:focus-visible) {
				background: linear-gradient(
					to bottom,
					var(--nimble-wound-track-filled-highlight-color) 0%,
					var(--nimble-wound-track-filled-color) 55%,
					var(--nimble-wound-track-filled-shade-color) 100%
				);
				box-shadow: var(--nimble-wound-track-segment-ring), var(--nimble-wound-track-filled-glow);
			}

			// Clicking a filled segment heals down to N-1, so hovering one previews N and every
			// filled segment after it emptying. Must stay after the filled rules it overrides.
			&--filled:hover,
			&--filled:focus-visible,
			&--filled:hover ~ &--filled,
			&--filled:focus-visible ~ &--filled {
				background: var(--nimble-wound-track-empty-background);
				box-shadow: var(--nimble-wound-track-segment-ring), var(--nimble-wound-track-inset-shadow);
			}
		}

		&__count {
			margin-inline-start: auto;
			font-variant-numeric: tabular-nums;

			&--wounded {
				color: var(--nimble-wound-track-count-color);
			}
		}
	}
</style>
