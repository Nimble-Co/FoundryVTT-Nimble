import type { OtherCreature } from '#types/otherCreature.d.ts';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import { ruleLabel } from '../actor/actorRules.js';
import type { AttackDelivery } from './attackDelivery.js';

/** One Primary Die Bonus as the card stores it, with the item of its rule. */
export interface PrimaryDieBonusRecord extends PrimaryDieBonusLine {
	itemUuid: string;
}

/** Structural view of a `primaryDieBonus` rule, so this module needs no rule import. */
interface PrimaryDieBonusRuleLike {
	type?: string;
	label?: string;
	parentDocument?: { name?: string; uuid?: string | null } | null;
	bonusFor?: (context: {
		delivery: AttackDelivery;
		other: OtherCreature | null;
		origin?: string;
	}) => number;
}

/**
 * The Primary Die Bonus rules of the attacker that add to this attack, each
 * with what it adds. A rule that adds 0 is left out.
 */
export function collectPrimaryDieBonuses(
	attacker: { rules?: unknown[] } | null | undefined,
	delivery: AttackDelivery,
	target: OtherCreature | null,
	origin: string | undefined,
): PrimaryDieBonusRecord[] {
	const lines: PrimaryDieBonusRecord[] = [];
	for (const rule of (attacker?.rules ?? []) as PrimaryDieBonusRuleLike[]) {
		if (rule?.type !== 'primaryDieBonus') continue;
		const value = rule.bonusFor?.({ delivery, other: target, origin }) ?? 0;
		if (value === 0) continue;
		lines.push({
			label: ruleLabel(rule),
			value,
			itemUuid: rule.parentDocument?.uuid ?? '',
		});
	}
	return lines;
}
