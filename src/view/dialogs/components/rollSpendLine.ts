import localize from '#utils/localize.js';

function joinWithAnd(parts: readonly string[]): string {
	return parts
		.filter(Boolean)
		.reduce(
			(first, second) =>
				first ? localize('NIMBLE.rollWindow.spendBoth', { first, second }) : second,
			'',
		);
}

/**
 * "When you roll, it spends 1 action and 2 Mana and you sacrifice 14 HP."; empty when the roll
 * spends nothing.
 */
export function rollSpendLine(
	actions = 0,
	other: string | readonly string[] = '',
	sacrificed: readonly string[] = [],
): string {
	const actionWords =
		actions > 0
			? localize(`NIMBLE.rollWindow.${actions > 1 ? 'spendActions' : 'spendAction'}`, {
					count: String(actions),
				})
			: '';
	const spent = joinWithAnd([actionWords, ...(typeof other === 'string' ? [other] : other)]);
	const sacrifice = joinWithAnd(sacrificed);
	if (spent && sacrifice) {
		return localize('NIMBLE.rollWindow.spendsAndSacrifices', { spent, sacrificed: sacrifice });
	}
	if (sacrifice) return localize('NIMBLE.rollWindow.sacrifices', { cost: sacrifice });
	return spent ? localize('NIMBLE.rollWindow.spends', { cost: spent }) : '';
}

/** "A free attack (<feature>): it spends no action.", with the Rushed Attack note when it ignores them. */
export function freeAttackNote(source: string, ignoresRushed: boolean): string {
	if (!source) return '';
	return localize(`NIMBLE.rollWindow.${ignoresRushed ? 'freeAttackNoRushed' : 'freeAttack'}`, {
		source,
	});
}
