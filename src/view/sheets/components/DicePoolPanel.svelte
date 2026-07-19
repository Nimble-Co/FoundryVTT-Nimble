<script lang="ts">
	import type { NimbleCharacter } from '#documents/actor/character.js';
	import { dieSizeToMaxFace } from '#utils/dicePool/helpers.js';
	import type { DieSize } from '#utils/dicePool/types.js';
	import localize from '../../../utils/localize.js';
	import { createDicePoolPanelState } from './DicePoolPanel.svelte.ts';
	import type { LivePoolView } from './DicePoolTracker.svelte.ts';

	let {
		actor,
		pool,
		onClose,
		preselectConsumerKey = null,
		onPreselectHandled,
	}: {
		actor: NimbleCharacter;
		pool: LivePoolView;
		onClose: () => void;
		preselectConsumerKey?: string | null;
		onPreselectHandled?: () => void;
	} = $props();

	const panel = createDicePoolPanelState(
		() => actor,
		() => pool,
	);

	// Apply a pending spend request from an item activation: pre-select the
	// requested consumer once it appears in this pool's consumer list.
	$effect(() => {
		if (!preselectConsumerKey) return;
		if (panel.selectConsumerByKey(preselectConsumerKey)) onPreselectHandled?.();
	});

	// Local controlled values for the per-die number inputs. Synced to the live
	// pool whenever its faces change (so external edits flow into the inputs).
	let dieInputValues = $state<number[]>([]);
	let chargeInputValue = $state(0);

	$effect(() => {
		const livePool = panel.pool;
		if (livePool && livePool.kind === 'rolled') {
			dieInputValues = [...livePool.faces];
		}
	});

	$effect(() => {
		const livePool = panel.pool;
		if (livePool && livePool.kind === 'count') {
			chargeInputValue = livePool.current;
		}
	});

	function maxFaceFor(dieSize: string): number {
		return dieSizeToMaxFace(dieSize as DieSize);
	}

	async function commitDieValue(index: number, value: number, dieSize: string): Promise<void> {
		const max = maxFaceFor(dieSize);
		const clamped = Math.max(1, Math.min(max, Math.floor(value)));
		dieInputValues[index] = clamped;
		await panel.setDieValue(index, clamped);
	}

	async function incrementDie(index: number, dieSize: string): Promise<void> {
		const current = dieInputValues[index] ?? 1;
		await commitDieValue(index, current + 1, dieSize);
	}

	async function decrementDie(index: number, dieSize: string): Promise<void> {
		const current = dieInputValues[index] ?? 1;
		await commitDieValue(index, current - 1, dieSize);
	}

	async function commitChargeCurrent(value: number): Promise<void> {
		const livePool = panel.pool;
		if (!livePool || livePool.kind !== 'count') return;
		const clamped = Math.max(0, Math.min(livePool.max, Math.floor(value)));
		chargeInputValue = clamped;
		await panel.setChargeCurrent(clamped);
	}
</script>

{#if panel.pool}
	{@const livePool = panel.pool}
	<section
		class="dice-pool-panel"
		aria-label={localize('NIMBLE.dicePoolTracker.panel.ariaLabel', { label: livePool.label })}
	>
		<header class="dice-pool-panel__header">
			<h3 class="dice-pool-panel__title">{livePool.label}</h3>
			<span class="dice-pool-panel__meta">
				{#if livePool.kind === 'rolled'}
					{localize('NIMBLE.dicePoolTracker.panel.rolledMeta', {
						count: String(livePool.faces.length),
						max: String(livePool.max),
						total: String(livePool.total),
					})}
				{:else}
					{localize('NIMBLE.dicePoolTracker.panel.countMeta', {
						current: String(livePool.current),
						max: String(livePool.max),
					})}
				{/if}
			</span>
		</header>

		{#if livePool.kind === 'rolled'}
			{#if livePool.faces.length > 0}
				<section class="dice-pool-panel__section">
					<h4 class="dice-pool-panel__section-heading">
						{localize('NIMBLE.dicePoolTracker.panel.editDice.heading')}
					</h4>
					<div class="dice-pool-panel__die-rows">
						{#each livePool.faces as _value, i (i)}
							{@const maxFace = maxFaceFor(livePool.dieSize)}
							<div class="dice-pool-panel__die-row">
								<input
									class="dice-pool-panel__die-input"
									type="number"
									min="1"
									max={maxFace}
									bind:value={dieInputValues[i]}
									onchange={() => commitDieValue(i, dieInputValues[i] ?? 1, livePool.dieSize)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											commitDieValue(i, dieInputValues[i] ?? 1, livePool.dieSize);
										}
									}}
								/>
								<button
									type="button"
									class="dice-pool-panel__die-button"
									aria-label={localize('NIMBLE.dicePoolTracker.panel.editDice.decrement')}
									data-tooltip={localize('NIMBLE.dicePoolTracker.panel.editDice.decrement')}
									onclick={() => decrementDie(i, livePool.dieSize)}
								>
									<i class="fa-solid fa-minus"></i>
								</button>
								<button
									type="button"
									class="dice-pool-panel__die-button"
									aria-label={localize('NIMBLE.dicePoolTracker.panel.editDice.increment')}
									data-tooltip={localize('NIMBLE.dicePoolTracker.panel.editDice.increment')}
									onclick={() => incrementDie(i, livePool.dieSize)}
								>
									<i class="fa-solid fa-plus"></i>
								</button>
								<button
									type="button"
									class="dice-pool-panel__die-button dice-pool-panel__die-button--discard"
									aria-label={localize('NIMBLE.dicePoolTracker.panel.editDice.discard')}
									data-tooltip={localize('NIMBLE.dicePoolTracker.panel.editDice.discard')}
									onclick={() => panel.discardDie(i)}
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if livePool.hasConsumers && panel.consumers.length > 0 && livePool.faces.length > 0}
				<section class="dice-pool-panel__section">
					<h4 class="dice-pool-panel__section-heading">
						{localize('NIMBLE.dicePoolTracker.panel.useFeature.heading')}
					</h4>
					<div class="dice-pool-panel__features">
						{#each panel.consumers as consumer (panel.consumerKey(consumer))}
							{@const key = panel.consumerKey(consumer)}
							{@const isExpanded = key === panel.selectedConsumerKey}
							<div
								class="dice-pool-panel__feature-card"
								class:dice-pool-panel__feature-card--expanded={isExpanded}
							>
								<button
									type="button"
									class="dice-pool-panel__feature"
									aria-expanded={isExpanded}
									aria-controls="dice-pool-panel-feature-body-{key}"
									onclick={() => panel.selectConsumer(consumer)}
								>
									{#if consumer.itemImg}
										<img class="dice-pool-panel__feature-img" src={consumer.itemImg} alt="" />
									{:else}
										<span
											class="dice-pool-panel__feature-img dice-pool-panel__feature-img--placeholder"
										>
											<i class="fa-solid fa-star"></i>
										</span>
									{/if}
									<span class="dice-pool-panel__feature-name">{consumer.itemName}</span>
									<i
										class="dice-pool-panel__feature-chevron fa-solid fa-chevron-down"
										aria-hidden="true"
									></i>
								</button>

								{#if isExpanded}
									<div
										id="dice-pool-panel-feature-body-{key}"
										class="dice-pool-panel__feature-body"
									>
										<h5 class="dice-pool-panel__section-subheading">
											{localize('NIMBLE.dicePoolTracker.panel.useFeature.pickDice')}
										</h5>
										<div class="dice-pool-panel__chips">
											{#each livePool.faces as value, i (i)}
												{@const chipSelected = panel.selectedIndices.has(i)}
												<button
													type="button"
													class="dice-pool-panel__chip"
													class:dice-pool-panel__chip--selected={chipSelected}
													aria-pressed={chipSelected}
													aria-label={localize(
														'NIMBLE.dicePoolTracker.panel.useFeature.toggleDie',
														{ value: String(value) },
													)}
													onclick={() => panel.toggleDie(i)}
												>
													{value}
												</button>
											{/each}
										</div>

										<div class="dice-pool-panel__summary">
											<span>
												{localize('NIMBLE.dicePoolTracker.panel.useFeature.summary', {
													count: String(panel.selectedCount),
													total: String(panel.selectedSum),
												})}
											</span>
											{#if panel.livePreviewTotal !== null && panel.selectedCount > 0}
												<span class="dice-pool-panel__effect-preview">
													{localize('NIMBLE.dicePoolTracker.panel.useFeature.effectPreview', {
														total: String(panel.livePreviewTotal),
													})}
												</span>
											{/if}
										</div>

										<button
											type="button"
											class="dice-pool-panel__spend-button"
											disabled={panel.selectedCount < 1}
											onclick={() => panel.spend()}
										>
											<i class="fa-solid fa-dice"></i>
											{#if panel.selectedCount > 0}
												{localize('NIMBLE.dicePoolTracker.panel.useFeature.spendWithCount', {
													count: String(panel.selectedCount),
												})}
											{:else}
												{localize('NIMBLE.dicePoolTracker.panel.useFeature.spend')}
											{/if}
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{:else}
			<section class="dice-pool-panel__section">
				<h4 class="dice-pool-panel__section-heading">
					{localize('NIMBLE.dicePoolTracker.panel.editCharge.heading')}
				</h4>
				<label class="dice-pool-panel__charge-row">
					<span>
						{localize('NIMBLE.dicePoolTracker.panel.editCharge.label', {
							max: String(livePool.max),
						})}
					</span>
					<input
						class="dice-pool-panel__die-input"
						type="number"
						min="0"
						max={livePool.max}
						bind:value={chargeInputValue}
						onchange={() => commitChargeCurrent(chargeInputValue)}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								commitChargeCurrent(chargeInputValue);
							}
						}}
					/>
				</label>
			</section>
		{/if}

		<footer class="dice-pool-panel__footer">
			<button type="button" class="dice-pool-panel__close-button" onclick={() => onClose()}>
				{localize('NIMBLE.dicePoolTracker.panel.close')}
			</button>
		</footer>
	</section>
{/if}

<style lang="scss">
	.dice-pool-panel {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 22rem;
		padding: 0.6rem 0.75rem;
		background: color-mix(in srgb, var(--nimble-sheet-background) 85%, transparent);
		border: 1px solid var(--nimble-dice-pool-tracker-panel-border-color);
		border-radius: 6px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);

		&__header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;
		}

		&__title {
			margin: 0;
			font-size: 1rem;
			font-weight: 700;
		}

		&__meta {
			font-size: 0.75rem;
			color: var(--nimble-medium-text-color, var(--nimble-dark-text-color));
		}

		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}

		&__section-heading {
			margin: 0;
			font-size: 0.7rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--nimble-medium-text-color, var(--nimble-dark-text-color));
		}

		&__section-subheading {
			margin: 0.2rem 0 0;
			font-size: 0.7rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--nimble-medium-text-color, var(--nimble-dark-text-color));
		}

		&__die-rows {
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}

		&__die-row {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		&__die-input {
			width: 3rem;
			padding: 0.15rem 0.3rem;
			text-align: center;
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 1px solid var(--nimble-dice-pool-tracker-panel-border-color);
			border-radius: 3px;
			font-size: 0.85rem;
			font-weight: 600;
		}

		&__die-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.6rem;
			height: 1.6rem;
			padding: 0;
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 1px solid var(--nimble-dice-pool-tracker-panel-border-color);
			border-radius: 3px;
			cursor: pointer;
			color: var(--nimble-dark-text-color);
			font-size: 0.75rem;
			transition:
				background 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease;

			&:hover {
				border-color: var(--nimble-dice-pool-tracker-available-color);
				color: var(--nimble-dice-pool-tracker-available-color);
			}

			&--discard:hover {
				border-color: var(--nimble-dice-pool-tracker-expend-hover-color);
				color: var(--nimble-dice-pool-tracker-expend-hover-color);
			}
		}

		&__features {
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}

		&__feature-card {
			border: 1px solid
				var(--nimble-card-border-color, var(--nimble-dice-pool-tracker-panel-border-color));
			border-radius: 4px;
			background: var(--nimble-card-background-color, var(--nimble-sheet-background));
			overflow: hidden;
			transition:
				border-color 0.15s ease,
				box-shadow 0.15s ease;

			&--expanded {
				border-color: var(--nimble-dice-pool-tracker-available-color);
				box-shadow: 0 0 0 1px var(--nimble-dice-pool-tracker-available-color);
			}
		}

		&__feature {
			display: flex;
			width: 100%;
			align-items: center;
			gap: 0.5rem;
			padding: 0.35rem 0.45rem;
			background: transparent;
			border: none;
			cursor: pointer;
			text-align: left;
			color: inherit;
			transition: background 0.15s ease;

			&:hover {
				background: color-mix(
					in srgb,
					var(--nimble-dice-pool-tracker-available-color) 10%,
					transparent
				);
			}
		}

		&__feature-chevron {
			flex-shrink: 0;
			font-size: 0.7rem;
			color: var(--nimble-dark-text-color);
			transition: transform 0.15s ease;

			.dice-pool-panel__feature-card--expanded & {
				transform: rotate(180deg);
			}
		}

		&__feature-body {
			padding: 0.35rem 0.55rem 0.55rem;
			border-top: 1px solid
				var(--nimble-card-border-color, var(--nimble-dice-pool-tracker-panel-border-color));
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}

		&__feature-img {
			flex-shrink: 0;
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 3px;
			object-fit: cover;
			background-color: rgba(0, 0, 0, 0.5);

			&--placeholder {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				color: var(--nimble-dark-text-color);
				font-size: 0.8rem;
			}
		}

		&__feature-name {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 600;
			font-size: 0.85rem;
		}

		&__chips {
			display: flex;
			flex-wrap: wrap;
			gap: 0.3rem;
		}

		&__chip {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 1.75rem;
			height: 1.75rem;
			padding: 0 0.35rem;
			background: var(--nimble-dice-pool-tracker-badge-background);
			border: 2px solid var(--nimble-dice-pool-tracker-available-color);
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.8rem;
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

			&--selected {
				background: var(--nimble-dice-pool-tracker-available-color);
				color: var(--nimble-sheet-background);

				&:hover {
					background: var(--nimble-dice-pool-tracker-expend-hover-color);
					border-color: var(--nimble-dice-pool-tracker-expend-hover-color);
					color: var(--nimble-sheet-background);
				}
			}
		}

		&__summary {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			gap: 0.5rem;
			padding: 0.3rem 0.4rem;
			background: var(--nimble-dice-pool-tracker-badge-background);
			border-radius: 4px;
			font-size: 0.8rem;
			font-weight: 600;
		}

		&__effect-preview {
			color: var(--nimble-dice-pool-tracker-available-color);
		}

		&__spend-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.4rem;
			padding: 0.4rem 0.75rem;
			background: var(--nimble-dice-pool-tracker-available-color);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-sheet-background);
			font-weight: 700;
			transition: background 0.15s ease;

			&:hover {
				background: var(--nimble-dice-pool-tracker-expend-hover-color);
			}

			&:disabled {
				cursor: default;
				opacity: 0.4;
			}
		}

		&__charge-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			font-size: 0.85rem;
		}

		&__footer {
			display: flex;
			justify-content: flex-end;
		}

		&__close-button {
			padding: 0.3rem 0.75rem;
			background: transparent;
			border: 1px solid var(--nimble-dice-pool-tracker-panel-border-color);
			border-radius: 4px;
			cursor: pointer;
			color: var(--nimble-dark-text-color);
			font-size: 0.8rem;
			transition:
				background 0.15s ease,
				border-color 0.15s ease;

			&:hover {
				border-color: var(--nimble-dice-pool-tracker-available-color);
				color: var(--nimble-dice-pool-tracker-available-color);
			}
		}
	}
</style>
