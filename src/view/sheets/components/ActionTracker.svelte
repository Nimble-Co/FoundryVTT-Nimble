<script>
	import localize from '../../../utils/localize.js';
	import { createActionTrackerState, getDiceIcon } from './ActionTracker.svelte.ts';

	// ============================================================================
	// Props
	// ============================================================================

	let { actor } = $props();

	// ============================================================================
	// State
	// ============================================================================

	const state = createActionTrackerState(() => actor);

	// Initialize the pip animation effect
	state.setupPipAnimationEffect();
</script>

{#if state.showCombatBar}
	<div class="action-tracker">
		<div class="action-tracker__panel">
			{#if state.needsInitiative}
				<button
					class="action-tracker__initiative-btn"
					type="button"
					aria-label={localize('NIMBLE.ui.heroicActions.rollInitiative')}
					data-tooltip={localize('NIMBLE.ui.heroicActions.rollInitiative')}
					data-tooltip-direction="RIGHT"
					onclick={state.rollInitiative}
				>
					<i class="fa-solid fa-dice-d20"></i>
				</button>
			{:else if state.hasInitiative}
				<div class="action-tracker__pips">
					{#each { length: state.actionsData.max }, i}
						{@const isAvailable = i < state.actionsData.current}
						{@const isJustSpent = state.justSpentPips.has(i)}
						{@const diceIcon = getDiceIcon(i)}

						<button
							class="action-tracker__pip"
							class:action-tracker__pip--available={isAvailable}
							class:action-tracker__pip--spent={!isAvailable}
							class:action-tracker__pip--just-spent={isJustSpent}
							type="button"
							aria-label={state.getPipAriaLabel(i, isAvailable)}
							data-tooltip={state.getPipTooltip(isAvailable)}
							data-tooltip-direction="RIGHT"
							onclick={() => state.handlePipClick(i)}
						>
							<i class="fa-solid {diceIcon}"></i>
						</button>
					{/each}
				</div>

				{#if state.isMyTurn}
					{@const allActionsUsed = state.actionsData.current === 0}
					<button
						class="action-tracker__end-turn"
						class:action-tracker__end-turn--ready={allActionsUsed}
						type="button"
						aria-label={localize('NIMBLE.ui.heroicActions.endTurn')}
						data-tooltip={localize('NIMBLE.ui.heroicActions.endTurn')}
						data-tooltip-direction="RIGHT"
						onclick={state.endTurn}
					>
						<i class="fa-solid fa-forward-step"></i>
					</button>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	.action-tracker {
		position: absolute;
		top: 15rem;
		left: 0;

		&__panel {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.125rem;
			padding: 0.25rem;
			background: color-mix(in srgb, var(--nimble-sheet-background) 85%, transparent);
			border: 1px solid var(--nimble-card-border-color);
			border-left: none;
			border-radius: 0 6px 6px 0;
			box-shadow:
				0 2px 4px rgba(0, 0, 0, 0.15),
				inset 0 1px 0 rgba(255, 255, 255, 0.1);

			:global(.theme-light) & {
				border-color: hsl(220, 10%, 70%);
			}
		}

		&__initiative-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.625rem;
			padding: 0;
			background: hsl(210, 60%, 50%);
			border: 1px solid hsl(210, 60%, 44%);
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.15s ease;

			i {
				font-size: 0.875rem;
				color: var(--nimble-light-text-color);
			}

			&:hover {
				background: hsl(210, 60%, 44%);
				border-color: hsl(210, 60%, 38%);
			}
		}

		&__pips {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__pip {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.625rem;
			padding: 0;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.15s ease;

			:global(.theme-light) & {
				border-color: hsl(220, 10%, 70%);
			}

			i {
				font-size: 1.25rem;
				transition: all 0.15s ease;
			}

			&:hover {
				border-color: var(--nimble-accent-color);
			}

			&--available {
				i {
					color: hsl(139, 47%, 44%);
				}

				&:hover i {
					color: hsl(139, 47%, 55%);
					filter: drop-shadow(0 0 4px hsl(139, 47%, 44%));
				}
			}

			&--spent {
				i {
					color: var(--nimble-medium-text-color);
					opacity: 0.5;
				}

				&:hover i {
					opacity: 0.7;
				}
			}

			&--just-spent {
				animation: pip-spent 0.6s ease-out;

				i {
					animation: pip-icon-spent 0.6s ease-out;
				}
			}
		}

		&__end-turn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.625rem;
			padding: 0;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s ease;

			:global(.theme-light) & {
				border-color: hsl(220, 10%, 70%);
			}

			i {
				font-size: 0.75rem;
				color: var(--nimble-medium-text-color);
			}

			&:hover {
				border-color: var(--nimble-accent-color);
			}

			&--ready {
				position: relative;
				background: hsl(139, 47%, 44%);
				border-color: hsl(139, 47%, 36%);
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

				i {
					color: white;
				}

				&::before,
				&::after {
					content: '';
					position: absolute;
					inset: -2px;
					border: 2px solid hsl(145, 40%, 25%);
					border-radius: 6px;
					opacity: 0;
					animation: end-turn-ping 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite;

					:global(.theme-dark) & {
						border-color: hsl(145, 40%, 65%);
					}
				}

				&::after {
					animation-delay: 1.1s;
				}

				&:hover {
					background: hsl(139, 47%, 38%);
					border-color: hsl(139, 47%, 30%);
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);

					&::before,
					&::after {
						animation: none;
						opacity: 0;
					}
				}

				&:active {
					background: hsl(139, 47%, 34%);
					box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
				}
			}
		}
	}

	:global(.theme-dark) .action-tracker__panel {
		background: hsla(220, 15%, 15%, 0.95);
		border-color: hsl(220, 10%, 30%);
	}

	:global(.theme-dark) .action-tracker__pip {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}

	:global(.theme-dark) .action-tracker__end-turn:not(.action-tracker__end-turn--ready) {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}

	@keyframes pip-spent {
		0% {
			transform: scale(1);
			border-color: hsl(139, 47%, 44%);
		}
		30% {
			transform: scale(1.15);
			border-color: hsl(45, 70%, 50%);
		}
		100% {
			transform: scale(1);
			border-color: var(--nimble-card-border-color);
		}
	}

	@keyframes pip-icon-spent {
		0% {
			color: hsl(139, 47%, 44%);
			opacity: 1;
			transform: scale(1);
		}
		30% {
			color: hsl(45, 70%, 50%);
			opacity: 1;
			transform: scale(1.2);
		}
		100% {
			color: var(--nimble-medium-text-color);
			opacity: 0.5;
			transform: scale(1);
		}
	}

	@keyframes end-turn-ping {
		0% {
			inset: 0;
			opacity: 0.4;
		}
		20% {
			inset: -2px;
			opacity: 0.3;
		}
		60% {
			inset: -4px;
			opacity: 0.15;
		}
		100% {
			inset: -6px;
			opacity: 0;
		}
	}
</style>
