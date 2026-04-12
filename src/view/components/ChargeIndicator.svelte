<script lang="ts">
	import type { ChargeIndicatorProps } from '#types/components/ChargeIndicator.d.ts';
	import { getPoolsForItem } from '#utils/chargePool/chargePoolSync.js';
	import { ChargeUiConfig } from '#utils/chargeUiConfig.js';
	import localize from '#utils/localize.js';
	import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
	import ConfigureChargesDialog from '#view/dialogs/ConfigureChargesDialog.svelte';

	let { pools, actor, itemId }: ChargeIndicatorProps = $props();

	function getPoolColor(pool: ChargeIndicatorProps['pools'][number]): string {
		if (pool.current >= pool.max) return 'var(--nimble-charge-color-full)';
		if (pool.current <= 0) return 'var(--nimble-charge-color-empty)';
		return 'var(--nimble-charge-color-partial)';
	}

	function escapeHtml(value: string): string {
		return foundry.utils.escapeHTML(value);
	}

	function getRecoveryTriggerLabel(trigger: string): string {
		const localizationKey =
			ChargeUiConfig.recoveryTriggerLocalizationKeys[
				trigger as keyof typeof ChargeUiConfig.recoveryTriggerLocalizationKeys
			];
		if (!localizationKey) return trigger;
		return localize(localizationKey);
	}

	function getRecoveryModeLabel(mode: string, value: string): string {
		const localizationKey =
			ChargeUiConfig.recoveryModeLocalizationKeys[
				mode as keyof typeof ChargeUiConfig.recoveryModeLocalizationKeys
			];
		if (!localizationKey) return `${mode}: ${value}`;

		if (mode === 'refresh') {
			return localize(localizationKey);
		}

		return localize(localizationKey, { value: escapeHtml(value) });
	}

	function getPoolTooltip(pool: ChargeIndicatorProps['pools'][number]): string {
		const escapedLabel = escapeHtml(pool.label);
		const recoveries = pool.recoveries
			.map((recovery) => {
				const trigger = escapeHtml(getRecoveryTriggerLabel(recovery.trigger));
				const mode = escapeHtml(getRecoveryModeLabel(recovery.mode, recovery.value));
				return `<li class="nimble-charge-tooltip__recovery"><strong>${trigger}:</strong> ${mode}</li>`;
			})
			.join('');

		const recoveryMarkup =
			recoveries.length > 0
				? recoveries
				: `<li class="nimble-charge-tooltip__recovery">${escapeHtml(localize('NIMBLE.charges.noRecoveryConfigured'))}</li>`;

		return `
			<header class="nimble-tooltip__enricher-header">
				<h3 class="nimble-tooltip__enricher-heading">${escapedLabel}</h3>
				<span class="nimble-tooltip__tag nimble-tooltip__tag--item">${pool.current}/${pool.max}</span>
			</header>
			<section class="nimble-tooltip__description-wrapper">
				<p class="nimble-charge-tooltip__section-label">${escapeHtml(localize('NIMBLE.charges.recoveryMethods'))}</p>
				<ul class="nimble-charge-tooltip__recovery-list">
					${recoveryMarkup}
				</ul>
			</section>
		`;
	}

	async function openChargesDialog(event: MouseEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();

		const item = actor.items.get(itemId);
		const itemName = item?.name ?? localize(ChargeUiConfig.unknownItemLocalizationKey);
		const poolsForItem = getPoolsForItem(actor, itemId);

		const dialog = GenericDialog.getOrCreate(
			`${localize('NIMBLE.charges.configure')}: ${itemName}`,
			ConfigureChargesDialog,
			{ document: actor, pools: poolsForItem },
			{ icon: 'fa-solid fa-bolt', width: 360, uniqueId: `${actor.id}-charges-${itemId}` },
		);

		await dialog.render(true);
	}
</script>

{#if pools.length > 0}
	<div class="charge-indicator">
		{#each pools as pool (pool.id)}
			<button
				type="button"
				class="charge-indicator__pill"
				style="--pill-color: {getPoolColor(pool)}"
				data-tooltip={getPoolTooltip(pool)}
				data-tooltip-class="nimble-tooltip nimble-tooltip--charge"
				data-tooltip-direction="RIGHT"
				onclick={openChargesDialog}
			>
				{#if pool.icon}
					<i class="charge-indicator__icon {pool.icon}" aria-hidden="true"></i>
				{:else}
					<i class="{ChargeUiConfig.defaultPoolIcon} charge-indicator__icon" aria-hidden="true"></i>
				{/if}
				<span class="charge-indicator__value">{pool.current}/{pool.max}</span>
			</button>
		{/each}
	</div>
{/if}

<style lang="scss">
	.charge-indicator {
		--nimble-charge-color-full: var(--nimble-success-color, hsl(120, 45%, 40%));
		--nimble-charge-color-empty: var(--nimble-danger-color, hsl(0, 55%, 50%));
		--nimble-charge-color-partial: var(--nimble-warning-color, hsl(45, 70%, 40%));
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.25rem;

		&__pill {
			display: flex;
			align-items: center;
			gap: 0.2rem;
			padding: 0.125rem 0.375rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--pill-color);
			border-radius: 4px;
			color: var(--pill-color);
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover {
				background: var(--pill-color);
				color: var(--nimble-card-background-color);
			}
		}

		&__icon {
			font-size: var(--nimble-xs-text);
			line-height: 1;
		}

		&__value {
			line-height: 1;
		}
	}
</style>
