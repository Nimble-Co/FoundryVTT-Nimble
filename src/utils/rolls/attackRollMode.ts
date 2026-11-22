import { type AttackOrigin, rulesReachingAttack } from '../damage/attackOrigin.js';

/** What the Attack Roll Mode rules that reach an attack do to one attack, all of them together. */
export interface AttackRollModeTotal {
	advantage: number;
	ignoreDisadvantage: boolean;
}

/** The roll mode change of the rules that reach an attack made through the item of `origin`. */
export function attackRollModeOf(
	attacker: { rules?: unknown } | null | undefined,
	origin: Partial<AttackOrigin> | null | undefined,
): AttackRollModeTotal {
	const total: AttackRollModeTotal = { advantage: 0, ignoreDisadvantage: false };
	for (const rule of rulesReachingAttack(attacker, 'attackRollMode', origin)) {
		const change = rule.changeFor(origin?.identifier);
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
