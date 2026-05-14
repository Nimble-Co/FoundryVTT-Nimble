<script>
	import { createDicePoolTrackerState, getDieFaceIcon } from './DicePoolTracker.svelte.ts';

	// ============================================================================
	// Props
	// ============================================================================

	let { actor } = $props();

	// ============================================================================
	// State
	// ============================================================================

	const state = createDicePoolTrackerState(() => actor);
</script>

{#if state.hasDicePools}
	<div class="dice-pool-tracker">
		<div class="dice-pool-tracker__panel">
			{#each state.dicePools as pool (pool.identifier)}
				{#if pool.poolMode === 'resource'}
					<!-- Static badge shows die type; pips are individual die-face icons -->
					<div
						class="dice-pool-tracker__badge dice-pool-tracker__badge--static"
						data-tooltip="{pool.label} ({pool.current}/{pool.max})"
						data-tooltip-direction="RIGHT"
					>
						<i class="fa-solid {getDieFaceIcon(pool.faces)}"></i>
					</div>

					{#each { length: pool.max }, i}
						{@const isAvailable = i < pool.current}
						<button
							class="dice-pool-tracker__pip"
							class:dice-pool-tracker__pip--available={isAvailable}
							class:dice-pool-tracker__pip--spent={!isAvailable}
							type="button"
							aria-label={isAvailable ? `Spend 1 ${pool.label}` : `Restore 1 ${pool.label}`}
							data-tooltip={isAvailable ? 'Click to spend' : 'Click to restore'}
							data-tooltip-direction="RIGHT"
							onclick={() => state.handlePoolPipClick(pool.identifier, i, isAvailable)}
						>
							<i class="fa-solid {getDieFaceIcon(pool.faces)}"></i>
						</button>
					{/each}
				{:else if pool.poolMode === 'individual'}
					<!-- Individual die mode: static badge + one chip per rolled die value -->
					<div
						class="dice-pool-tracker__badge dice-pool-tracker__badge--static"
						data-tooltip={pool.dice.length > 0
							? `${pool.label} (${pool.dice.length}/${pool.max}) – Total: ${pool.current}`
							: `${pool.label} (0/${pool.max})`}
						data-tooltip-direction="RIGHT"
					>
						<i class="fa-solid {getDieFaceIcon(pool.faces)}"></i>
					</div>

					{#each pool.dice as value, i (i)}
						<button
							class="dice-pool-tracker__die-chip"
							type="button"
							aria-label="Spend {pool.label} die (value: {value})"
							data-tooltip="Rolled {value} – Click to spend"
							data-tooltip-direction="RIGHT"
							onclick={() => state.spendDie(pool.identifier, i)}
						>
							{value}
						</button>
					{/each}

					{#if pool.dice.length > 1}
						<div
							class="dice-pool-tracker__die-total"
							data-tooltip="{pool.label} total: {pool.current}"
							data-tooltip-direction="RIGHT"
						>
							{pool.current}
						</div>
					{/if}
				{:else}
					<!-- Clickable badge rolls the pool; value chip shows stored total -->
					<button
						class="dice-pool-tracker__badge dice-pool-tracker__badge--roll"
						type="button"
						aria-label="{pool.label} – Click to roll"
						data-tooltip={pool.poolMode === 'accumulate'
							? `${pool.label} – Click to roll 1 die (max ${pool.max})`
							: `${pool.label} – Click to roll`}
						data-tooltip-direction="RIGHT"
						onclick={() => state.rollPool(pool)}
					>
						<i class="fa-solid {getDieFaceIcon(pool.faces)}"></i>
					</button>

					<button
						class="dice-pool-tracker__value-chip"
						class:dice-pool-tracker__value-chip--empty={pool.current <= 0}
						type="button"
						aria-label="Expend {pool.label} (current: {pool.current})"
						data-tooltip={pool.current > 0
							? `Stored: ${pool.current} – Click to expend`
							: `${pool.label} – nothing stored`}
						data-tooltip-direction="RIGHT"
						onclick={() => state.expendPool(pool.identifier)}
					>
						{pool.current > 0 ? pool.current : '–'}
					</button>
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

		// Badge: the die-face icon cell.
		// Static variant (resource mode) = display only. Non-static = clickable roll button.
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

			// Roll badge (store/accumulate): neutral header look but still clickable
			&--roll {
				border-width: 1px;
				border-color: var(--nimble-dark-text-color);

				i {
					color: var(--nimble-dark-text-color);
				}

				&:hover {
					background: hsl(220, 10%, 94%);

					i {
						filter: none;
					}
				}
			}

			&:not(&--static):not(&--roll):hover {
				background: hsl(210, 75%, 92%);

				i {
					filter: drop-shadow(0 0 4px var(--dp-available));
				}
			}
		}

		// Pips: one per die in a resource pool (e.g. Commander Combat Dice).
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

				&:hover {
					border-color: var(--dp-available);

					i {
						color: var(--dp-available);
					}
				}
			}
		}

		// Individual die chips: one per rolled die in 'individual' mode.
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

		// Running total shown below the individual die chips.
		&__die-total {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			padding: 0.1rem 0;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--dp-spent);
			border-top: 1px solid hsl(220, 10%, 78%);
		}

		// Value chip: shows the accumulated/stored total for non-resource pools.
		// Click to expend (clear to zero).
		&__value-chip {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			min-height: 1.625rem;
			padding: 0.125rem 0;
			background: #fff;
			border: 2px solid var(--dp-available);
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--dp-available);
			transition:
				border-color 0.15s ease,
				color 0.15s ease;

			&:hover {
				border-color: var(--dp-expend-hover);
				color: var(--dp-expend-hover);
			}

			&--empty {
				border-width: 1px;
				border-color: hsl(220, 10%, 78%);
				color: var(--dp-spent);
				cursor: default;

				&:hover {
					border-color: hsl(220, 10%, 78%);
					color: var(--dp-spent);
				}
			}
		}
	}

	// ── Dark theme ──────────────────────────────────────────────────────────────
	// All dark overrides use explicit, contrast-checked values.

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
		border-color: var(--dp-available);

		i {
			color: var(--dp-available);
		}

		&:not(.dice-pool-tracker__badge--static):not(.dice-pool-tracker__badge--roll) {
			background: hsl(220, 18%, 24%);
			box-shadow: 0 0 8px color-mix(in srgb, var(--dp-available) 45%, transparent);

			i {
				filter: drop-shadow(0 0 5px var(--dp-available));
			}

			&:hover {
				background: hsl(220, 18%, 30%);
				box-shadow: 0 0 14px color-mix(in srgb, var(--dp-available) 65%, transparent);

				i {
					filter: drop-shadow(0 0 8px var(--dp-available));
				}
			}
		}

		&.dice-pool-tracker__badge--static {
			border-color: var(--nimble-dark-text-color);
			box-shadow: none;

			i {
				color: var(--nimble-dark-text-color);
				filter: none;
			}
		}

		&.dice-pool-tracker__badge--roll {
			border-color: var(--nimble-dark-text-color);
			box-shadow: none;

			i {
				color: var(--nimble-dark-text-color);
				filter: none;
			}

			&:hover {
				background: hsl(220, 15%, 26%);
			}
		}
	}

	:global(.theme-dark) .dice-pool-tracker__pip {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover {
			background: hsl(220, 15%, 24%);
		}

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

			&:hover {
				border-color: hsl(210, 50%, 55%);

				i {
					color: hsl(210, 70%, 65%);
					filter: none;
				}
			}
		}
	}

	:global(.theme-dark) .dice-pool-tracker__value-chip {
		background: hsl(220, 18%, 24%);
		border-color: var(--dp-available);
		color: var(--dp-available);
		box-shadow: 0 0 6px color-mix(in srgb, var(--dp-available) 35%, transparent);

		&:hover {
			background: hsl(220, 18%, 30%);
			border-color: var(--dp-expend-hover);
			color: var(--dp-expend-hover);
			box-shadow: none;
		}

		&.dice-pool-tracker__value-chip--empty {
			background: hsl(220, 15%, 18%);
			border-color: hsl(220, 10%, 30%);
			color: var(--dp-spent);
			box-shadow: none;

			&:hover {
				border-color: hsl(220, 10%, 30%);
				color: var(--dp-spent);
			}
		}
	}

	:global(.theme-dark) .dice-pool-tracker__die-chip {
		background: hsl(220, 18%, 24%);
		border-color: var(--dp-available);
		color: var(--dp-available);
		box-shadow: 0 0 6px color-mix(in srgb, var(--dp-available) 35%, transparent);

		&:hover {
			background: hsl(220, 18%, 30%);
			border-color: var(--dp-expend-hover);
			color: var(--dp-expend-hover);
			box-shadow: none;
		}
	}

	:global(.theme-dark) .dice-pool-tracker__die-total {
		color: var(--dp-spent);
		border-top-color: hsl(220, 10%, 30%);
	}
</style>
