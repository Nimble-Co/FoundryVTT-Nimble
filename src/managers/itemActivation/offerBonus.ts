import type { OfferBonus } from '#types/attackOutcome.d.ts';
import type { DamagePart } from '#types/damagePart.d.ts';
import type { DamageNode } from '#types/effectTree.js';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import type { DamageRoll } from '../../dice/DamageRoll.js';
import type { AttackOrigin } from '../../utils/damage/attackOrigin.js';
import { createBonusDamageNode } from '../../utils/treeManipulation/createBonusDamageNode.js';

/**
 * The formula with the flat bonuses of the attack's damage type added, the lines
 * each bonus adds to the Primary Die, and a damage part for each flat bonus.
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
		if (bonus.damage > 0 && !bonus.damageType) {
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

/** Each bonus with a damage type of its own, rolled as its own damage that a miss does not deal. */
export async function rollTypedOfferDamage(
	bonuses: readonly OfferBonus[],
): Promise<Array<{ node: DamageNode; roll: Roll }>> {
	const parts: Array<{ node: DamageNode; roll: Roll }> = [];
	for (const bonus of bonuses) {
		if (!bonus.damageType || bonus.damage <= 0) continue;
		const formula = String(bonus.damage);
		const roll = new Roll(formula) as Roll;
		await roll.evaluate();
		parts.push({
			node: createBonusDamageNode({
				damageType: bonus.damageType,
				formula,
				roll: roll.toJSON() as Record<string, unknown>,
				source: { label: bonus.label, uuid: bonus.itemUuid ?? '' },
			}),
			roll,
		});
	}
	return parts;
}
