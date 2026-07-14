<script lang="ts">
	import { systemHookName } from '#system';
	import type { DicePoolTrackerProps } from '#types/components/DicePoolTracker.d.ts';
	import { getDieFaceIcon } from '#utils/dicePool/dieFaceIcons.js';
	import localize from '../../../utils/localize.js';
	import DicePoolPanel from './DicePoolPanel.svelte';
	import { createDicePoolTrackerState } from './DicePoolTracker.svelte.ts';

	let { actor }: DicePoolTrackerProps = $props();

	const tracker = createDicePoolTrackerState(() => actor);

	// Item activations with a manual dice consumer request the spend UI here
	// (see DiceConsumerRule.onItemActivated). Registered for the tracker's
	// lifetime so the panel opens even while it is not rendered.
	$effect(() => {
		const hookName = systemHookName('dicePool.requestSpend');
		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: (payload: unknown) => void) => number;
			off: (hook: string, id: number) => void;
		};
		const hookId = hooksApi.on(hookName, (payload) =>
			tracker.handleSpendRequest(payload as Parameters<typeof tracker.handleSpendRequest>[0]),
		);
		return () => hooksApi.off(hookName, hookId);
	});
</script>

{#if tracker.hasPools}
	<div class="dice-pool-tracker">
		<div class="dice-pool-tracker__panel">
			{#each tracker.pools as pool, poolIndex (pool.identifier)}
				<div class="dice-pool-tracker__group">
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
								onclick={() => tracker.rollAndSpendCountPool(pool)}
							>
								<i class="fa-solid {getDieFaceIcon(pool.dieSize)}"></i>
							</button>
						{/each}

						{#if tracker.isOwner}
							<button
								class="dice-pool-tracker__action-chip"
								class:dice-pool-tracker__action-chip--open={tracker.isPanelOpen(pool.id)}
								type="button"
								aria-label={localize('NIMBLE.dicePoolTracker.togglePanel', {
									label: pool.label,
								})}
								data-tooltip={localize('NIMBLE.dicePoolTracker.togglePanel', {
									label: pool.label,
								})}
								data-tooltip-direction="RIGHT"
								onclick={() => tracker.togglePanel(pool.id)}
							>
								<i class="fa-solid fa-chevron-right"></i>
							</button>
						{/if}
					{:else if pool.faces.length > 0}
						<!-- Rolled pool with stored faces: badge is a passive identity
							 marker. The chevron chip toggles the inline DicePoolPanel
							 below (edit dice + use feature in one place). -->
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
								aria-label={localize('NIMBLE.dicePoolTracker.discardDieAria', {
									label: pool.label,
									value: String(value),
								})}
								data-tooltip={localize('NIMBLE.dicePoolTracker.rightClickToDiscard', {
									value: String(value),
								})}
								data-tooltip-direction="RIGHT"
								oncontextmenu={(e) => {
									e.preventDefault();
									tracker.discardRolledDie(pool.id, i);
								}}
							>
								{value}
							</button>
						{/each}

						{#if pool.kind === 'rolled' && pool.faces.length < pool.max && tracker.isOwner}
							<button
								class="dice-pool-tracker__die-chip dice-pool-tracker__add-die"
								type="button"
								aria-label={localize('NIMBLE.dicePoolTracker.rollOneIntoPool')}
								data-tooltip={localize('NIMBLE.dicePoolTracker.rollOneIntoPool')}
								data-tooltip-direction="RIGHT"
								onclick={() => tracker.rollOneIntoPool(pool.id)}
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						{/if}

						{#if pool.faces.length > 1}
							<button
								class="dice-pool-tracker__die-total"
								type="button"
								aria-label={localize('NIMBLE.dicePoolTracker.discardAllAria', {
									label: pool.label,
									total: String(pool.total),
								})}
								data-tooltip={localize('NIMBLE.dicePoolTracker.rightClickToDiscardAll', {
									total: String(pool.total),
								})}
								data-tooltip-direction="RIGHT"
								oncontextmenu={(e) => {
									e.preventDefault();
									tracker.discardAllRolled(pool.id);
								}}
							>
								{pool.total}
							</button>
						{/if}

						{#if tracker.isOwner}
							<button
								class="dice-pool-tracker__action-chip"
								class:dice-pool-tracker__action-chip--open={tracker.isPanelOpen(pool.id)}
								type="button"
								aria-label={localize('NIMBLE.dicePoolTracker.togglePanel', {
									label: pool.label,
								})}
								data-tooltip={localize('NIMBLE.dicePoolTracker.togglePanel', {
									label: pool.label,
								})}
								data-tooltip-direction="RIGHT"
								onclick={() => tracker.togglePanel(pool.id)}
							>
								<i class="fa-solid fa-chevron-right"></i>
							</button>
						{/if}
					{:else}
						<!-- Rolled pool, currently empty: display-only badge. Pools fill via
							 refill triggers (e.g. Oathsworn Judgment Dice on `onAttacked`).
							 The tracker is a view, not the fill mechanism. The panel is
							 hidden for empty rolled pools because there are no dice to
							 edit and no useful spend flow. -->
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

						{#if pool.kind === 'rolled' && pool.faces.length < pool.max && tracker.isOwner}
							<button
								class="dice-pool-tracker__die-chip dice-pool-tracker__add-die"
								type="button"
								aria-label={localize('NIMBLE.dicePoolTracker.rollOneIntoPool')}
								data-tooltip={localize('NIMBLE.dicePoolTracker.rollOneIntoPool')}
								data-tooltip-direction="RIGHT"
								onclick={() => tracker.rollOneIntoPool(pool.id)}
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						{/if}
					{/if}

					{#if tracker.isPanelOpen(pool.id)}
						<!-- Inline expandable panel anchored to this pool's row. Each open
							 panel offsets vertically by its pool index so multiple open
							 panels stack down the right edge instead of overlapping. -->
						<div
							class="dice-pool-tracker__panel-anchor"
							style="--dice-pool-panel-offset: {poolIndex * 0.5}rem"
						>
							<DicePoolPanel
								{actor}
								{pool}
								onClose={() => tracker.closePanel(pool.id)}
								preselectConsumerKey={tracker.getSpendRequest(pool.id)}
								onPreselectHandled={() => tracker.clearSpendRequest(pool.id)}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style lang="scss">
	.dice-pool-tracker {
		position: relative;

		&__panel {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.625rem;
			padding: 0.25rem;
			background: color-mix(in srgb, var(--nimble-sheet-background) 85%, transparent);
			border: 1px solid var(--nimble-dice-pool-tracker-panel-border-color);
			border-left: none;
			border-radius: 0 6px 6px 0;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
		}

		&__group {
			position: relative;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.125rem;
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

		&__add-die {
			border-style: dashed;

			i {
				font-size: 0.75rem;
			}
		}

		// Per-pool chevron chip that toggles the inline DicePoolPanel for this
		// pool. Rotates 90° when open to flip from "›" (closed, opens →) to "⌄"
		// (open, panel currently shown to the right).
		&__action-chip {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.625rem;
			height: 1.125rem;
			padding: 0;
			background: var(--nimble-dice-pool-tracker-available-color);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-sheet-background);
			transition:
				background 0.15s ease,
				transform 0.15s ease;

			i {
				font-size: 0.75rem;
				transition: transform 0.15s ease;
			}

			&:hover {
				background: var(--nimble-dice-pool-tracker-expend-hover-color);
				transform: translateX(2px);
			}

			&--open {
				background: var(--nimble-dice-pool-tracker-expend-hover-color);

				i {
					transform: rotate(90deg);
				}
			}

			&:disabled {
				cursor: default;
				opacity: 0.35;
				transform: none;
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

		// Anchor for the inline DicePoolPanel. Mounts to the right of the
		// tracker. `--dice-pool-panel-offset` is set inline from the pool's
		// index so stacked panels don't overlap each other vertically.
		&__panel-anchor {
			position: absolute;
			top: var(--dice-pool-panel-offset, 0);
			left: calc(100% + 0.5rem);
			z-index: 10;
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
