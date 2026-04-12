<script lang="ts">
	import { ChargeUiConfig } from '#utils/chargeUiConfig.js';
	import localize from '#utils/localize.js';
	import { getContext } from 'svelte';

	let { node: _node } = $props();

	const messageDocument = getContext('messageDocument');
	let consumption = $derived(messageDocument?.reactive?.flags?.nimble?.chargeConsumption ?? []);

	function getChangeColor(change) {
		return change < 0
			? 'var(--nimble-roll-failure-color, hsl(1, 100%, 33%))'
			: 'var(--nimble-roll-success-color, hsl(120, 45%, 55%))';
	}

	function formatSignedDelta(value: number): string {
		return value < 0 ? String(value) : `+${value}`;
	}

	function formatRecoveryTrigger(trigger: string): string {
		const localizationKey =
			ChargeUiConfig.recoveryTriggerLocalizationKeys[
				trigger as keyof typeof ChargeUiConfig.recoveryTriggerLocalizationKeys
			];
		if (!localizationKey) return trigger;
		return localize(localizationKey);
	}
</script>

{#if consumption.length > 0}
	<section class="nimble-charge-consumption">
		{#each consumption as entry}
			{@const recoveryDelta = entry.recovery
				? entry.recovery.newValue - entry.recovery.previousValue
				: 0}
			{@const showDelta = entry.change !== 0 || recoveryDelta !== 0}
			{@const useRecoveryDelta = entry.recovery && recoveryDelta !== entry.change}
			<div class="nimble-charge-consumption__entry">
				<span class="nimble-charge-consumption__values">
					{#if showDelta}
						<span
							class={useRecoveryDelta
								? 'nimble-charge-consumption__recovery'
								: 'nimble-charge-consumption__change'}
							style="color: {getChangeColor(useRecoveryDelta ? recoveryDelta : entry.change)}"
							title={entry.recovery ? formatRecoveryTrigger(entry.recovery.trigger) : ''}
						>
							{useRecoveryDelta
								? `(${formatSignedDelta(recoveryDelta)})`
								: `(${formatSignedDelta(entry.change)})`}
						</span>
					{/if}
					<span class="nimble-charge-consumption__label">{entry.poolLabel}</span>
					({entry.recovery?.newValue ?? entry.currentValue}/{entry.maxValue})
				</span>
			</div>
		{/each}
	</section>
{/if}

<style lang="scss">
	.nimble-charge-consumption {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nimble-charge-consumption__entry {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--nimble-sm-text, 0.833rem);
	}

	.nimble-charge-consumption__label {
		font-weight: 500;
	}

	.nimble-charge-consumption__values {
		display: flex;
		gap: 0.375rem;
	}

	.nimble-charge-consumption__change {
		font-weight: 600;
	}

	.nimble-charge-consumption__recovery {
		font-size: var(--nimble-xs-text, 0.75rem);
		color: var(--nimble-roll-success-color, hsl(120, 45%, 55%));
		font-style: italic;
	}
</style>
