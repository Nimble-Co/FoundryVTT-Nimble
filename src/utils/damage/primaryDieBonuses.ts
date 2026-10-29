import type { OtherCreature } from '../actor/otherCreatureMatches.js';
import type { AttackDelivery } from './attackDelivery.js';

/** One Primary Die Bonus on an attack, for its line on the card. */
interface PrimaryDieBonusLine {
	label: string;
	value: number;
	itemUuid: string;
}

/** Structural view of a `primaryDieBonus` rule, so this module needs no rule import. */
interface PrimaryDieBonusRuleLike {
	type?: string;
	label?: string;
	item?: { name?: string; uuid?: string } | null;
	bonusFor?: (context: { delivery: AttackDelivery; other: OtherCreature | null }) => number;
}

/**
 * The Primary Die Bonus rules of the attacker that add to this attack, each
 * with what it adds. A rule that adds 0 is left out.
 */
export function collectPrimaryDieBonuses(
	attacker: { rules?: unknown[] } | null | undefined,
	delivery: AttackDelivery,
	target: OtherCreature | null,
): PrimaryDieBonusLine[] {
	if (!delivery) return [];
	const lines: PrimaryDieBonusLine[] = [];
	for (const rule of (attacker?.rules ?? []) as PrimaryDieBonusRuleLike[]) {
		if (rule?.type !== 'primaryDieBonus') continue;
		const value = rule.bonusFor?.({ delivery, other: target }) ?? 0;
		if (value === 0) continue;
		lines.push({
			label: rule.label || rule.item?.name || '',
			value,
			itemUuid: rule.item?.uuid ?? '',
		});
	}
	return lines;
}

export type { PrimaryDieBonusLine };
