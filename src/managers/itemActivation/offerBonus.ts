import type { OfferBonus } from '#types/attackOutcome.d.ts';
import type { DamagePart } from '#types/damagePart.d.ts';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import type { DamageRoll } from '../../dice/DamageRoll.js';

/** The identifier of the item whose offer row started this activation. */
export function offerSourceOf(uuid: string | undefined): string | undefined {
	if (!uuid) return undefined;
	const source = fromUuidSync(uuid as `Item.${string}`) as { identifier?: string } | null;
	return source?.identifier || undefined;
}

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

/** Record the offer on the roll options. */
export function markOfferOnRollOptions(
	options: DamageRoll.Options,
	offerSource: string | undefined,
): void {
	if (offerSource) options.offerSource = offerSource;
}
