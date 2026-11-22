import { ChargeUiConfig } from '#utils/chargePool/chargeUiConfig.js';
import { poolHeading } from '#utils/chargePool/poolHeading.js';
import type { ChargeConsumptionDetail } from '#utils/chargePool/types.js';
import localize from '#utils/localize.js';

const TEXT = 'NIMBLE.charges.cardLine';

function recoveryTriggerText(trigger: string): string {
	const key =
		ChargeUiConfig.recoveryTriggerLocalizationKeys[
			trigger as keyof typeof ChargeUiConfig.recoveryTriggerLocalizationKeys
		];
	return key ? localize(key) : trigger;
}

/**
 * The card line of what a use did to a charge pool, such as "Pool: spent 1, 2 of 3 left".
 * A note in brackets at the end of the pool label goes to the tooltip.
 */
export function chargeConsumptionLine(entry: ChargeConsumptionDetail): {
	text: string;
	tooltip: string | null;
} {
	const recoveryDelta = entry.recovery ? entry.recovery.newValue - entry.recovery.previousValue : 0;
	const byRecovery = !!entry.recovery && recoveryDelta !== entry.change;
	const delta = byRecovery ? recoveryDelta : entry.change;
	const current = entry.recovery?.newValue ?? entry.currentValue;
	const heading = poolHeading(entry.poolLabel);
	const left = entry.hideMax
		? String(current)
		: localize(`${TEXT}.countOf`, { current: String(current), max: String(entry.maxValue) });
	const key = delta < 0 ? 'spent' : delta > 0 ? 'regained' : 'left';
	return {
		text: localize(`${TEXT}.${key}`, {
			pool: heading.name,
			count: String(Math.abs(delta)),
			left,
		}),
		tooltip: entry.recovery ? recoveryTriggerText(entry.recovery.trigger) : heading.tooltip,
	};
}
