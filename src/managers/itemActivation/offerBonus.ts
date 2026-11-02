import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import type { DamageRoll } from '../../dice/DamageRoll.js';
import type { OfferBonus } from '../../models/rules/offerAttackBonus.js';

/** The identifier of the item whose offer row started this activation. */
export function offerSourceOf(uuid: string | undefined): string | undefined {
	if (!uuid) return undefined;
	const source = fromUuidSync(uuid as `Item.${string}`) as { identifier?: string } | null;
	return source?.identifier || undefined;
}

/** The formula with the flat bonuses added, and the lines each bonus adds to the Primary Die. */
export function addOfferBonuses(
	formula: string,
	bonuses: readonly OfferBonus[],
	isAoE: boolean,
): { formula: string; primaryDieBonuses: Array<PrimaryDieBonusLine & { itemUuid: string }> } {
	let next = formula;
	const primaryDieBonuses: Array<PrimaryDieBonusLine & { itemUuid: string }> = [];
	for (const bonus of bonuses) {
		if (bonus.damage > 0) next = `${next} + ${bonus.damage}`;
		if (bonus.primaryDie !== 0 && !isAoE) {
			primaryDieBonuses.push({
				label: bonus.label,
				value: bonus.primaryDie,
				itemUuid: '',
			});
		}
	}
	return { formula: next, primaryDieBonuses };
}

/** Record the offer on the roll options, and the bonuses that added damage for the card's tags. */
export function markOfferOnRollOptions(
	options: DamageRoll.Options,
	offerSource: string | undefined,
	bonuses: readonly OfferBonus[],
): void {
	if (offerSource) options.offerSource = offerSource;
	const offerDamage = bonuses.filter((bonus) => bonus.damage > 0);
	if (offerDamage.length > 0) {
		options.outcomeSources = {
			...options.outcomeSources,
			offerDamage: offerDamage.map((bonus) => bonus.label),
		} as DamageRoll.Options['outcomeSources'];
	}
}
