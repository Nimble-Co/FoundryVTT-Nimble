<script lang="ts">
	import type { ConfigureChargesDialogProps } from '#types/components/ConfigureChargesDialog.d.ts';
	import { ChargePoolService } from '#utils/chargePoolService.js';
	import { ChargeUiConfig } from '#utils/chargeUiConfig.js';
	import localize from '#utils/localize.js';

	type ChargePoolState = ConfigureChargesDialogProps['pools'][number];

	let { document: actor, dialog, pools }: ConfigureChargesDialogProps = $props();

	let poolValues: Record<string, number> = $state({});
	let editingPoolId: string | null = $state(null);
	let editValue: string = $state('');
	let activeEditInput: HTMLInputElement | null = $state(null);

	$effect(() => {
		for (const pool of pools) {
			poolValues[pool.id] ??= pool.current;
		}
	});

	$effect(() => {
		if (!editingPoolId || !activeEditInput) return;
		activeEditInput.focus();
		activeEditInput.select();
	});

	function getPoolColor(pool: ChargePoolState): string {
		const current = poolValues[pool.id] ?? pool.current;
		if (current >= pool.max) return 'var(--nimble-charge-color-full)';
		if (current <= 0) return 'var(--nimble-charge-color-empty)';
		return 'var(--nimble-charge-color-partial)';
	}

	function adjustPoolValue(poolId: string, delta: number): void {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool) return;
		const current = poolValues[poolId] ?? pool.current;
		const newValue = Math.max(0, Math.min(pool.max, current + delta));
		poolValues[poolId] = newValue;
	}

	function startEditing(pool: ChargePoolState): void {
		editingPoolId = pool.id;
		editValue = String(poolValues[pool.id] ?? pool.current);
	}

	function cancelEditing(): void {
		editingPoolId = null;
		editValue = '';
	}

	function confirmEdit(poolId: string): void {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool) return;
		const value = Number.parseInt(editValue, 10);
		if (Number.isFinite(value) && value >= 0) {
			poolValues[poolId] = Math.min(pool.max, value);
		}
		editingPoolId = null;
		editValue = '';
	}

	function handleEditInputKeydown(event: KeyboardEvent, poolId: string): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			confirmEdit(poolId);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	}

	function setToMax(poolId: string): void {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool) return;
		poolValues[poolId] = pool.max;
	}

	function setToEmpty(poolId: string): void {
		poolValues[poolId] = 0;
	}

	async function submit() {
		const changes: Array<{ pool: ChargePoolState; oldValue: number; newValue: number }> = [];
		const updates: Promise<boolean>[] = [];

		for (const [poolId, value] of Object.entries(poolValues)) {
			const pool = pools.find((p) => p.id === poolId);
			if (pool && pool.current !== value) {
				changes.push({ pool, oldValue: pool.current, newValue: value });
				updates.push(ChargePoolService.adjustPool(actor, poolId, 'set', value));
			}
		}

		if (updates.length > 0) {
			await Promise.all(updates);
		}

		if (changes.length > 0) {
			const itemName =
				pools[0]?.sourceItemName ?? localize(ChargeUiConfig.unknownItemLocalizationKey);
			const poolData = changes.map((c) => ({
				label: c.pool.label,
				previousValue: c.oldValue,
				newValue: c.newValue,
				icon: c.pool.icon,
			}));

			await ChatMessage.create({
				author: game.user?.id,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: 'chargeAdjustment',
				system: {
					actorName: actor.name,
					actorType: actor.type,
					image: actor.img,
					permissions: actor.ownership?.[game.user?.id ?? ''] ?? 0,
					rollMode: 0,
					itemName,
					pools: poolData,
				},
			});
		}

		dialog.submit();
	}
</script>

<article class="nimble-sheet__body nimble-configure-charges-dialog">
	{#if !pools || pools.length === 0}
		<p class="charges-empty">{CONFIG.NIMBLE.charges.noPoolsForItem}</p>
	{:else}
		<div class="charges-list">
			{#each pools as pool (pool?.id)}
				{#if pool}
					<div class="charge-pool-card">
						<div class="charge-pool-card__header">
							{#if pool.icon}
								<i class="charge-pool-card__icon {pool.icon}" aria-hidden="true"></i>
							{:else}
								<i
									class="{ChargeUiConfig.defaultPoolIcon} charge-pool-card__icon"
									aria-hidden="true"
								></i>
							{/if}
							<span class="charge-pool-card__label">{pool.label}</span>
						</div>

						<div class="charge-pool-card__current" style="color: {getPoolColor(pool)}">
							<button
								class="charge-pool-card__btn charge-pool-card__btn--minus"
								type="button"
								onclick={() => adjustPoolValue(pool.id, -1)}
								aria-label={localize('NIMBLE.charges.decreaseOne')}
								title={localize('NIMBLE.charges.decreaseOne')}
								disabled={(poolValues[pool.id] ?? pool.current) <= 0}
							>
								<i class="fa-solid fa-minus"></i>
							</button>

							{#if editingPoolId === pool.id}
								<input
									class="charge-pool-card__input"
									type="number"
									min="0"
									max={pool.max}
									bind:value={editValue}
									bind:this={activeEditInput}
									onkeydown={(event) => handleEditInputKeydown(event, pool.id)}
									onblur={() => confirmEdit(pool.id)}
								/>
							{:else}
								<button
									class="charge-pool-card__value charge-pool-card__value--button"
									type="button"
									onclick={() => startEditing(pool)}
									aria-label={localize('NIMBLE.charges.editCurrent', { pool: pool.label })}
								>
									{poolValues[pool.id] ?? pool.current}/{pool.max}
								</button>
							{/if}

							<button
								class="charge-pool-card__btn charge-pool-card__btn--plus"
								type="button"
								onclick={() => adjustPoolValue(pool.id, 1)}
								aria-label={localize('NIMBLE.charges.increaseOne')}
								title={localize('NIMBLE.charges.increaseOne')}
								disabled={(poolValues[pool.id] ?? pool.current) >= pool.max}
							>
								<i class="fa-solid fa-plus"></i>
							</button>
						</div>

						<div class="charge-pool-card__actions">
							<button
								class="charge-pool-card__btn charge-pool-card__btn--max"
								type="button"
								onclick={() => setToMax(pool.id)}
								aria-label={localize('NIMBLE.charges.setToMaxForPool', { pool: pool.label })}
							>
								{CONFIG.NIMBLE.charges.max}
							</button>
							<button
								class="charge-pool-card__btn charge-pool-card__btn--empty"
								type="button"
								onclick={() => setToEmpty(pool.id)}
								aria-label={localize('NIMBLE.charges.setToEmptyForPool', { pool: pool.label })}
							>
								{CONFIG.NIMBLE.charges.empty}
							</button>
						</div>

						<div class="charge-pool-card__source">
							<span class="charge-pool-card__source-label">
								{CONFIG.NIMBLE.charges.source}:
							</span>
							<span class="charge-pool-card__source-name">{pool.sourceItemName}</span>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}>
		{CONFIG.NIMBLE.charges.saveChanges}
	</button>
</footer>

<style lang="scss">
	.nimble-configure-charges-dialog {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		--nimble-charge-color-full: hsl(120, 45%, 40%);
		--nimble-charge-color-empty: hsl(0, 55%, 50%);
		--nimble-charge-color-partial: hsl(45, 70%, 40%);
		--nimble-charge-action-max-color: hsl(120, 45%, 40%);
		--nimble-charge-action-empty-color: hsl(0, 55%, 50%);
		--nimble-charge-card-dark-background: hsl(220, 15%, 12%);
		--nimble-charge-card-dark-border: hsl(220, 10%, 25%);
		--nimble-charge-card-dark-icon: hsl(220, 10%, 60%);
		--nimble-charge-card-dark-label: hsl(220, 10%, 80%);
		--nimble-charge-card-dark-current: hsl(220, 15%, 8%);
		--nimble-charge-card-dark-button-background: hsl(220, 15%, 18%);
		--nimble-charge-card-dark-button-border: hsl(220, 10%, 30%);
		--nimble-charge-card-dark-button-text: hsl(220, 10%, 75%);
		--nimble-charge-card-dark-button-hover: hsl(220, 15%, 28%);
		--nimble-charge-card-dark-button-hover-text: hsl(220, 10%, 90%);
		--nimble-charge-card-dark-input: hsl(220, 15%, 10%);
		--nimble-charge-card-dark-source-label: hsl(220, 10%, 55%);
		--nimble-charge-card-dark-source-name: hsl(220, 10%, 70%);
		--nimble-charge-card-dark-max-color: hsl(120, 45%, 60%);
		--nimble-charge-card-dark-max-border: hsl(120, 45%, 50%);
		--nimble-charge-card-dark-empty-color: hsl(0, 55%, 65%);
		--nimble-charge-card-dark-empty-border: hsl(0, 55%, 55%);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.charges-empty {
		margin: 0;
		padding: 1rem;
		text-align: center;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
		font-style: italic;
	}

	.charges-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.charge-pool-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__icon {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__current {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			padding: 0.375rem;
			background: var(--nimble-input-background-color);
			border-radius: 4px;
		}

		&__value {
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			min-width: 4rem;
			text-align: center;

			&--button {
				background: none;
				border: none;
				padding: 0;
				cursor: pointer;
				color: inherit;
				font-size: inherit;
				font-weight: inherit;

				&:hover {
					text-decoration: underline;
				}
			}
		}

		&__input {
			width: 3rem;
			padding: 0.25rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-align: center;
			background: var(--nimble-card-background-color);
			border: 1px solid var(--nimble-accent-color);
			border-radius: 4px;
			color: var(--nimble-dark-text-color);

			&:focus {
				outline: 2px solid var(--nimble-accent-color);
				outline-offset: -1px;
			}
		}

		&__actions {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}

		&__btn {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0.25rem 0.5rem;
			min-width: 1.75rem;
			height: 1.75rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			color: var(--nimble-dark-text-color);
			cursor: pointer;
			transition: all 0.15s ease;
			font-size: var(--nimble-xs-text);
			font-weight: 600;

			&:hover:not(:disabled) {
				background: var(--nimble-card-border-color);
				color: var(--nimble-light-text-color);
			}

			&:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			&--max {
				color: var(--nimble-charge-action-max-color);
				border-color: var(--nimble-charge-action-max-color);

				&:hover:not(:disabled) {
					background: var(--nimble-charge-action-max-color);
					color: white;
				}
			}

			&--empty {
				color: var(--nimble-charge-action-empty-color);
				border-color: var(--nimble-charge-action-empty-color);

				&:hover:not(:disabled) {
					background: var(--nimble-charge-action-empty-color);
					color: white;
				}
			}
		}

		&__source {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
		}

		&__source-label {
			color: var(--nimble-medium-text-color);
		}

		&__source-name {
			color: var(--nimble-dark-text-color);
			font-weight: 500;
		}
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	:global(.theme-dark) {
		.nimble-configure-charges-dialog {
			--nimble-charge-action-max-color: var(--nimble-charge-card-dark-max-color);
			--nimble-charge-action-empty-color: var(--nimble-charge-card-dark-empty-color);
		}

		.charge-pool-card {
			background: var(--nimble-charge-card-dark-background);
			border-color: var(--nimble-charge-card-dark-border);

			&__icon {
				color: var(--nimble-charge-card-dark-icon);
			}

			&__label {
				color: var(--nimble-charge-card-dark-label);
			}

			&__current {
				background: var(--nimble-charge-card-dark-current);
			}

			&__btn {
				background: var(--nimble-charge-card-dark-button-background);
				border-color: var(--nimble-charge-card-dark-button-border);
				color: var(--nimble-charge-card-dark-button-text);

				&:hover:not(:disabled) {
					background: var(--nimble-charge-card-dark-button-hover);
					color: var(--nimble-charge-card-dark-button-hover-text);
				}

				&--max {
					color: var(--nimble-charge-card-dark-max-color);
					border-color: var(--nimble-charge-card-dark-max-border);

					&:hover:not(:disabled) {
						background: var(--nimble-charge-action-max-color);
						color: white;
					}
				}

				&--empty {
					color: var(--nimble-charge-card-dark-empty-color);
					border-color: var(--nimble-charge-card-dark-empty-border);

					&:hover:not(:disabled) {
						background: var(--nimble-charge-action-empty-color);
						color: white;
					}
				}
			}

			&__input {
				background: var(--nimble-charge-card-dark-input);
				border-color: var(--nimble-accent-color);
				color: var(--nimble-charge-card-dark-label);
			}

			&__source-label {
				color: var(--nimble-charge-card-dark-source-label);
			}

			&__source-name {
				color: var(--nimble-charge-card-dark-source-name);
			}
		}
	}
</style>
