<script lang="ts">
	import type { ConfigureChargesDialogProps } from '#types/components/ConfigureChargesDialog.d.ts';
	import { adjustPool } from '#utils/chargePool/chargePoolRecover.js';
	import { ChargeUiConfig } from '#utils/chargePool/chargeUiConfig.js';
	import { poolCountText } from '#utils/chargePool/poolHeading.js';
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
				updates.push(adjustPool(actor, poolId, 'set', value));
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
							{#if pool.hidden}
								<i
									class="fa-solid fa-eye-slash charge-pool-card__hidden-marker"
									data-tooltip={localize('NIMBLE.charges.hiddenPoolHint')}
									aria-label={localize('NIMBLE.charges.hiddenPoolHint')}
								></i>
							{/if}
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
									data-look="plain"
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
									{poolCountText(poolValues[pool.id] ?? pool.current, pool.max, pool.hideMax)}
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
		--nimble-charge-color-full: var(--nimble-ui-action);
		--nimble-charge-color-empty: var(--nimble-ui-vital);
		--nimble-charge-color-partial: var(--nimble-ui-warn);

		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		color: var(--nimble-ui-ink);
	}

	:global(.system-nimble .nimble-window) .nimble-configure-charges-dialog {
		gap: 10px;
		padding: 12px;
	}

	.charges-empty {
		margin: 0;
		padding: 8px 4px;
		text-align: center;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);
	}

	.charges-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.charge-pool-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		font-family: var(--nimble-primary-font);

		&__header {
			display: flex;
			align-items: center;
			gap: 6px;
		}

		&__icon {
			font-size: 0.75rem;
			color: var(--nimble-ui-ink-dim);
		}

		&__label {
			font-size: 0.688rem;
			font-weight: 900;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--nimble-ui-ink-dim);
		}

		&__hidden-marker {
			font-size: 0.688rem;
			color: var(--nimble-ui-ink-dim);
			cursor: help;
		}

		&__current {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
		}

		&__value {
			min-width: 4rem;
			text-align: center;

			&--button {
				height: 26px;
				margin: 0;
				padding: 0 3px;
				border: 0;
				border-bottom: 1px dashed var(--nimble-ui-ring);
				border-radius: 0;
				background: none;
				box-shadow: none;
				font-family: var(--nimble-primary-font);
				font-size: 1rem;
				font-weight: 900;
				color: inherit;
				cursor: text;

				&:hover {
					border-bottom-color: var(--nimble-ui-highlight);
				}

				&:focus-visible {
					outline: 2px solid var(--nimble-ui-focus);
					outline-offset: 1px;
				}
			}
		}

		&__input {
			box-sizing: border-box;
			width: 4rem;
			height: 26px;
			margin: 0;
			padding: 0 3px;
			border: 0;
			border-bottom: 1px dashed var(--nimble-ui-ring);
			border-radius: 0;
			background: none;
			box-shadow: none;
			font-family: var(--nimble-primary-font);
			font-size: 0.875rem;
			font-weight: 700;
			text-align: center;
			color: var(--nimble-ui-ink);
			appearance: textfield;

			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				display: none;
			}

			&:focus {
				border-bottom: 1px solid var(--nimble-ui-highlight);
				outline: none;
			}
		}

		&__actions {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
		}

		&__btn {
			display: flex;
			flex: none;
			align-items: center;
			justify-content: center;
			min-width: 26px;
			height: 26px;
			margin: 0;
			padding: 0 9px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			background: none;
			box-shadow: none;
			font-family: var(--nimble-primary-font);
			font-size: 0.75rem;
			font-weight: 700;
			line-height: 1;
			white-space: nowrap;
			color: var(--nimble-ui-ink);
			cursor: pointer;
			transition:
				border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);

			i {
				font-size: 0.688rem;
			}

			&:hover:not(:disabled) {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-hover);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}

			&:disabled {
				border-style: dashed;
				color: var(--nimble-ui-ink-muted);
				cursor: default;
			}

			&--minus,
			&--plus {
				width: 26px;
				padding: 0;
			}
		}

		&__source {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 0.75rem;
		}

		&__source-label {
			color: var(--nimble-ui-ink-dim);
		}

		&__source-name {
			font-weight: 600;
			color: var(--nimble-ui-ink);
		}
	}
</style>
