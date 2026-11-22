import type { OfferBonus } from '#types/attackOutcome.d.ts';
import type { DamagePart } from '#types/damagePart.d.ts';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import type { DamageRoll } from '../../dice/DamageRoll.js';
import type { AttackOrigin } from '../../utils/damage/attackOrigin.js';

/**
 * The formula with the flat bonuses added, the lines each bonus adds to the
 * Primary Die, and a damage part for each flat bonus.
 */
export function addOfferBonuses(
	formula: string,
	bonuses: readonly OfferBonus[],
	isAoE: boolean,
): {
	formula: string;
	primaryDieBonuses: Array<PrimaryDieBonusLine & { itemUuid: string }>;
	damageParts: DamagePart[];
} {
	let next = formula;
	const primaryDieBonuses: Array<PrimaryDieBonusLine & { itemUuid: string }> = [];
	const damageParts: DamagePart[] = [];
	for (const bonus of bonuses) {
		const itemUuid = bonus.itemUuid ?? '';
		if (bonus.damage > 0) {
			next = `${next} + ${bonus.damage}`;
			damageParts.push({ label: bonus.label, itemUuid, amount: bonus.damage });
		}
		if (bonus.primaryDie !== 0 && !isAoE) {
			primaryDieBonuses.push({ label: bonus.label, value: bonus.primaryDie, itemUuid });
		}
	}
	return { formula: next, primaryDieBonuses, damageParts };
}

/** Record the origin on the roll options. */
export function markOfferOnRollOptions(options: DamageRoll.Options, origin: AttackOrigin): void {
	if (origin.uuid) options.origin = origin;
}
