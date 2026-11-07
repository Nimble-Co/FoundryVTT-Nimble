import { ChargeUiConfig } from '#utils/chargePool/chargeUiConfig.js';

/** The lang key of each refill or recovery trigger, for dice pools and charge pools. */
const POOL_TRIGGER_LABELS: Readonly<Record<string, string>> = {
	...ChargeUiConfig.recoveryTriggerLocalizationKeys,
	onAttacked: 'NIMBLE.rules.dicePool.refills.trigger.choices.onAttacked',
	onCritReceived: 'NIMBLE.rules.dicePool.refills.trigger.choices.onCritReceived',
};

/** The lang key of each refill or recovery mode. The sheet's charge mode keys hold a `{value}` slot. */
const POOL_MODE_LABELS: Readonly<Record<string, string>> = {
	add: 'NIMBLE.rules.dicePool.refills.mode.choices.add',
	set: 'NIMBLE.rules.dicePool.refills.mode.choices.set',
	refresh: ChargeUiConfig.recoveryModeLocalizationKeys.refresh,
	setIfEmpty: 'NIMBLE.rules.dicePool.refills.mode.choices.setIfEmpty',
	clear: 'NIMBLE.rules.dicePool.refills.mode.choices.clear',
};

function labelled<T extends string>(
	values: readonly T[],
	labels: Readonly<Record<string, string>>,
): Record<T, string> {
	return Object.fromEntries(values.map((value) => [value, labels[value] ?? value])) as Record<
		T,
		string
	>;
}

/** Select choices for pool triggers, as value to lang key. */
function poolTriggerChoices<T extends string>(values: readonly T[]): Record<T, string> {
	return labelled(values, POOL_TRIGGER_LABELS);
}

/** Select choices for pool modes, as value to lang key. */
function poolModeChoices<T extends string>(values: readonly T[]): Record<T, string> {
	return labelled(values, POOL_MODE_LABELS);
}

export { poolModeChoices, poolTriggerChoices };
