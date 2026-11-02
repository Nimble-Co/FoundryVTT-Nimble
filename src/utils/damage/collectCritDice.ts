import type { CritDiceSpec } from '#types/critDice.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { markTurnUse } from '../combat/perTurnUse.js';
import type { AttackDelivery } from './attackDelivery.js';

interface CritDiceRuleLike {
	type?: string;
	specFor?(delivery: AttackDelivery | null): CritDiceSpec | null;
}

/** The crit dice of the attacker's rules for this attack. With Feature Effects off, a row adds them. */
export function collectCritDice(
	attacker: { rules?: unknown } | null | undefined,
	delivery: AttackDelivery | null,
): CritDiceSpec[] {
	if (!isRuleAutomationEnabled() || !delivery) return [];
	const rules = attacker?.rules;
	if (!rules || typeof (rules as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
	return Array.from(rules as Iterable<CritDiceRuleLike>).flatMap((rule) => {
		const spec = rule?.type === 'critDice' ? rule.specFor?.(delivery) : null;
		return spec ? [spec] : [];
	});
}

/** Spend the 1/turn uses of the crit dice a posted roll has. */
export async function spendCritDiceUses(
	actor: Actor | null | undefined,
	roll: { critDiceKeys?(): string[]; options?: { critDice?: CritDiceSpec[] } } | null | undefined,
): Promise<void> {
	for (const key of roll?.critDiceKeys?.() ?? []) {
		const spec = roll?.options?.critDice?.find((each) => each.key === key);
		if (spec?.oncePerTurn) await markTurnUse(actor, key);
	}
}
