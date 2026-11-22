import { rulesOfType } from '../actor/actorRules.js';

/** What the attacker's Attack Roll Mode rules do to one attack, all of them together. */
export interface AttackRollModeTotal {
	advantage: number;
	ignoreDisadvantage: boolean;
}

/** The roll mode change of the attacker's rules for an attack made through the item with this identifier. */
export function attackRollModeOf(
	attacker: { rules?: unknown } | null | undefined,
	origin: string | null | undefined,
): AttackRollModeTotal {
	const total: AttackRollModeTotal = { advantage: 0, ignoreDisadvantage: false };
	for (const rule of rulesOfType(attacker, 'attackRollMode')) {
		const change = rule.changeFor(origin);
		if (!change) continue;
		total.advantage += change.advantage;
		total.ignoreDisadvantage ||= change.ignoreDisadvantage;
	}
	return total;
}

/** The roll mode an attack starts at with the change: disadvantage out first, then the advantage. */
export function rollModeWith(rollMode: number, change: AttackRollModeTotal): number {
	const base = change.ignoreDisadvantage ? Math.max(0, rollMode) : rollMode;
	return base + change.advantage;
}
