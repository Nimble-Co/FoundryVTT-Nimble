import localize from '#utils/localize.js';

/** "When you roll, it spends 1 action and 2 Mana."; empty when the roll spends nothing. */
export function rollSpendLine(actions = 0, other = ''): string {
	const actionWords =
		actions > 0
			? localize(`NIMBLE.rollWindow.${actions > 1 ? 'spendActions' : 'spendAction'}`, {
					count: String(actions),
				})
			: '';
	const cost =
		actionWords && other
			? localize('NIMBLE.rollWindow.spendBoth', { first: actionWords, second: other })
			: actionWords || other;
	return cost ? localize('NIMBLE.rollWindow.spends', { cost }) : '';
}
