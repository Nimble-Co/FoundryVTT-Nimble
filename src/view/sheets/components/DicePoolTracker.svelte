<script lang="ts">
	import type { DicePoolTrackerProps } from '#types/components/DicePoolTracker.d.ts';
	import localize from '../../../utils/localize.js';
	import { createDicePoolTrackerState, getDieFaceIcon } from './DicePoolTracker.svelte.ts';

	let { actor }: DicePoolTrackerProps = $props();

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
						data-tooltip={localize('NIMBLE.dicePoolTracker.countTooltip', {
							label: pool.label,
							current: String(pool.current),
							max: String(pool.max),
						})}
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
							aria-label={isAvailable
								? localize('NIMBLE.dicePoolTracker.rollAndSpendOne', { label: pool.label })
								: localize('NIMBLE.dicePoolTracker.spent', { label: pool.label })}
							data-tooltip={isAvailable
								? localize('NIMBLE.dicePoolTracker.clickToRoll')
								: localize('NIMBLE.dicePoolTracker.spent', { label: pool.label })}
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
						data-tooltip={localize('NIMBLE.dicePoolTracker.rolledTooltip', {
							label: pool.label,
							count: String(pool.faces.length),
							max: String(pool.max),
							total: String(pool.total),
						})}
						data-tooltip-direction="RIGHT"
					>
						<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
					</div>

					{#each pool.faces as value, i (i)}
						<button
							class="dice-pool-tracker__die-chip"
							type="button"
							aria-label={localize('NIMBLE.dicePoolTracker.spendDieAria', {
								label: pool.label,
								value: String(value),
							})}
							data-tooltip={localize('NIMBLE.dicePoolTracker.clickToSpend', {
								value: String(value),
							})}
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
							aria-label={localize('NIMBLE.dicePoolTracker.expendAllAria', {
								label: pool.label,
								total: String(pool.total),
							})}
							data-tooltip={localize('NIMBLE.dicePoolTracker.expendAllTooltip', {
								total: String(pool.total),
							})}
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
						data-tooltip={localize('NIMBLE.dicePoolTracker.emptyTooltip', {
							label: pool.label,
							max: String(pool.max),
						})}
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
		&__panel {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.125rem;
			padding: 0.25rem;
			background: color-mix(in srgb, var(--nimble-sheet-background) 85%, transparent);
			border: 1px solid var(--nimble-dice-pool-tracker-panel-border-color);
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
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 2px solid var(--nimble-dice-pool-tracker-available-color);
			border-radius: 4px;
			cursor: pointer;
			transition:
				background 0.15s ease,
				box-shadow 0.15s ease;

			i {
				font-size: 1rem;
				color: var(--nimble-dice-pool-tracker-available-color);
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
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 1px solid var(--nimble-dice-pool-tracker-pip-border-color);
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
				border-color: var(--nimble-dice-pool-tracker-available-color);

				i {
					color: var(--nimble-dice-pool-tracker-available-color);
				}

				&:hover {
					background: var(--nimble-dice-pool-tracker-pip-hover-background);

					i {
						filter: drop-shadow(0 0 4px var(--nimble-dice-pool-tracker-available-color));
					}
				}
			}

			&--spent {
				i {
					color: var(--nimble-dice-pool-tracker-spent-color);
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
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 2px solid var(--nimble-dice-pool-tracker-available-color);
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--nimble-dice-pool-tracker-available-color);
			transition:
				border-color 0.15s ease,
				color 0.15s ease,
				background 0.15s ease;

			&:hover {
				border-color: var(--nimble-dice-pool-tracker-expend-hover-color);
				color: var(--nimble-dice-pool-tracker-expend-hover-color);
				background: var(--nimble-dice-pool-tracker-chip-hover-background);
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
			color: var(--nimble-dice-pool-tracker-spent-color);
			background: transparent;
			border: none;
			border-top: 1px solid var(--nimble-dice-pool-tracker-total-border-color);
			cursor: pointer;

			&:hover {
				color: var(--nimble-dice-pool-tracker-expend-hover-color);
			}
		}
	}

	// Dark-theme-only structural overrides for pip background. Color tokens
	// (border, hover, etc.) are themed via custom properties in _theme.scss.
	:global(.theme-dark) .dice-pool-tracker {
		&__pip {
			background: var(--nimble-dice-pool-tracker-pip-background);

			&.dice-pool-tracker__pip--available {
				border-color: var(--nimble-dice-pool-tracker-pip-available-border-color);

				&:hover i {
					filter: drop-shadow(0 0 5px var(--nimble-dice-pool-tracker-available-color));
				}
			}
		}

		&__badge {
			box-shadow: none;

			&--static i {
				filter: none;
			}
		}
	}
</style>
