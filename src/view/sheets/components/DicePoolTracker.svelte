<script lang="ts">
	import { getDieFaceIcon } from '#utils/dicePool/dieFaceIcons.js';
	import { createDicePoolTrackerState } from './DicePoolTracker.svelte.ts';

	let { actor } = $props();

	const state = createDicePoolTrackerState(() => actor);
</script>

{#if state.hasPools}
	<div class="dice-pool-tracker">
		<div class="dice-pool-tracker__panel">
			{#each state.pools as pool (pool.identifier)}
				{#if pool.kind === 'count'}
					<!-- Roll-on-spend (e.g. Commander Combat Dice): static die-face badge, then one pip per charge. -->
					<div
						class="dice-pool-tracker__badge dice-pool-tracker__badge--static"
						data-tooltip="{pool.label} ({pool.current}/{pool.max})"
						data-tooltip-direction="RIGHT"
					>
						<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
					</div>

					{#each { length: pool.max }, i}
						{@const isAvailable = i < pool.current}
						<button
							class="dice-pool-tracker__pip"
							class:dice-pool-tracker__pip--available={isAvailable}
							class:dice-pool-tracker__pip--spent={!isAvailable}
							type="button"
							disabled={!isAvailable}
							aria-label={isAvailable ? `Roll and spend 1 ${pool.label}` : `${pool.label} spent`}
							data-tooltip={isAvailable ? 'Click to roll & spend' : 'Spent'}
							data-tooltip-direction="RIGHT"
							onclick={() => state.rollAndSpendCountPool(pool)}
						>
							<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
						</button>
					{/each}
				{:else if pool.faces.length > 0}
					<!-- Rolled pool with stored faces: static badge + one chip per rolled die. -->
					<div
						class="dice-pool-tracker__badge dice-pool-tracker__badge--static"
						data-tooltip="{pool.label} ({pool.faces.length}/{pool.max}) – Total: {pool.total}"
						data-tooltip-direction="RIGHT"
					>
						<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
					</div>

					{#each pool.faces as value, i (i)}
						<button
							class="dice-pool-tracker__die-chip"
							type="button"
							aria-label="Spend {pool.label} die (value: {value})"
							data-tooltip="Rolled {value} – Click to spend"
							data-tooltip-direction="RIGHT"
							onclick={() => state.expendRolledDie(pool.id, i)}
						>
							{value}
						</button>
					{/each}

					{#if pool.faces.length > 1}
						<button
							class="dice-pool-tracker__die-total"
							type="button"
							aria-label="Expend all {pool.label} ({pool.total})"
							data-tooltip="Expend all – total {pool.total}"
							data-tooltip-direction="RIGHT"
							onclick={() => state.expendAllRolled(pool.id)}
						>
							{pool.total}
						</button>
					{/if}
				{:else}
					<!-- Rolled pool, currently empty: display-only badge. Pools fill via
						 refill triggers (e.g. Oathsworn Judgment Dice on `onAttacked`).
						 The tracker is a view, not the fill mechanism. -->
					<div
						class="dice-pool-tracker__badge dice-pool-tracker__badge--static"
						data-tooltip="{pool.label} (0/{pool.max})"
						data-tooltip-direction="RIGHT"
					>
						<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<style lang="scss">
	.dice-pool-tracker {
		// Color tokens — override per theme so a single var(--dp-*) works everywhere.
		// Light: hsl(210,65%,46%) ~3.5:1 on white (WCAG AA for non-text UI elements)
		// Dark:  hsl(210,80%,63%) ~5:1 on hsl(220,15%,16%)
		--dp-available: hsl(210, 65%, 46%);
		--dp-spent: hsl(220, 10%, 58%);
		--dp-expend-hover: hsl(0, 65%, 58%);

		&__panel {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.125rem;
			padding: 0.25rem;
			background: color-mix(in srgb, var(--nimble-sheet-background) 85%, transparent);
			border: 1px solid hsl(220, 10%, 70%);
			border-left: none;
			border-radius: 0 6px 6px 0;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
		}

		&__badge {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.625rem;
			padding: 0;
			background: #fff;
			border: 2px solid var(--dp-available);
			border-radius: 4px;
			cursor: pointer;
			transition:
				background 0.15s ease,
				box-shadow 0.15s ease;

			i {
				font-size: 1rem;
				color: var(--dp-available);
				transition: filter 0.15s ease;
			}

			&--static {
				border-width: 1px;
				border-color: var(--nimble-dark-text-color);
				cursor: default;

				i {
					color: var(--nimble-dark-text-color);
				}
			}
		}

		&__pip {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.625rem;
			padding: 0;
			background: #fff;
			border: 1px solid hsl(220, 10%, 78%);
			border-radius: 4px;
			cursor: pointer;
			transition:
				border-color 0.15s ease,
				background 0.15s ease;

			i {
				font-size: 0.875rem;
				transition:
					color 0.15s ease,
					filter 0.15s ease;
			}

			&--available {
				border-color: var(--dp-available);

				i {
					color: var(--dp-available);
				}

				&:hover {
					background: hsl(210, 75%, 92%);

					i {
						filter: drop-shadow(0 0 4px var(--dp-available));
					}
				}
			}

			&--spent {
				i {
					color: var(--dp-spent);
				}
			}

			&:disabled {
				cursor: default;
			}
		}

		&__die-chip {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.625rem;
			padding: 0;
			background: #fff;
			border: 2px solid var(--dp-available);
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--dp-available);
			transition:
				border-color 0.15s ease,
				color 0.15s ease,
				background 0.15s ease;

			&:hover {
				border-color: var(--dp-expend-hover);
				color: var(--dp-expend-hover);
				background: hsl(0, 65%, 96%);
			}
		}

		&__die-total {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			padding: 0.1rem 0;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--dp-spent);
			background: transparent;
			border: none;
			border-top: 1px solid hsl(220, 10%, 78%);
			cursor: pointer;

			&:hover {
				color: var(--dp-expend-hover);
			}
		}
	}

	:global(.theme-dark) .dice-pool-tracker {
		--dp-available: hsl(210, 80%, 63%);
		--dp-spent: hsl(220, 10%, 50%);
	}

	:global(.theme-dark) .dice-pool-tracker__panel {
		background: hsla(220, 15%, 13%, 0.97);
		border-color: hsl(220, 10%, 28%);
	}

	:global(.theme-dark) .dice-pool-tracker__badge {
		background: hsl(220, 15%, 20%);
		border-color: var(--nimble-dark-text-color);
		box-shadow: none;

		i {
			color: var(--nimble-dark-text-color);
			filter: none;
		}
	}

	:global(.theme-dark) .dice-pool-tracker__pip {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&.dice-pool-tracker__pip--available {
			border-color: hsl(210, 85%, 55%);

			i {
				color: var(--dp-available);
			}

			&:hover {
				background: hsl(220, 18%, 26%);

				i {
					filter: drop-shadow(0 0 5px var(--dp-available));
				}
			}
		}

		&.dice-pool-tracker__pip--spent {
			i {
				color: var(--dp-spent);
			}
		}
	}
</style>
