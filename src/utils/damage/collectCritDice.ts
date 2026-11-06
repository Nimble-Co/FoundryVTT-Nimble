import type { CritDiceSpec } from '#types/critDice.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { rulesOfType } from '../actor/actorRules.js';
import { markTurnUse } from '../combat/perTurnUse.js';
import type { AttackDelivery } from './attackDelivery.js';

/** The crit dice of the attacker's rules for this attack. With Feature Effects off, a row adds them. */
export function collectCritDice(
	attacker: { rules?: unknown } | null | undefined,
	delivery: AttackDelivery | null,
): CritDiceSpec[] {
	if (!isRuleAutomationEnabled() || !delivery) return [];
	return rulesOfType(attacker, 'critDice').flatMap((rule) => {
		const spec = rule.specFor(delivery);
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
