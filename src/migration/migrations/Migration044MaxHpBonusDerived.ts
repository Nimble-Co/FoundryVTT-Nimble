import { MigrationBase } from '../MigrationBase.js';

/**
 * `maxHpBonus` rules used to bank their contribution into the character's
 * stored `system.attributes.hp.bonus`. That value is derived now, so the banked
 * amount has to come back out or every affected character counts it twice.
 *
 * Nothing recorded what each rule had contributed, so the banked amount is
 * reconstructed as what the rule resolves to today. That is exact for a flat
 * rule — every `maxHpBonus` in the shipped compendiums is flat — and for a
 * `perLevel` rule on a character who has not levelled since acquiring it.
 *
 * A `perLevel` rule on a character who *has* levelled is the bug being fixed
 * (#499): the banked amount lagged, so the reconstruction overshoots what is
 * actually stored. Clamping at zero treats the whole stored bonus as
 * rule-derived there, which is right unless the character also had a manual
 * bonus — that case keeps a discrepancy until someone reopens Edit Hit Points.
 */
class Migration044MaxHpBonusDerived extends MigrationBase {
	static override readonly version = 44;

	override readonly version = Migration044MaxHpBonusDerived.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const hp = source.system?.attributes?.hp;
		if (!hp) return;

		const level = source.system?.classData?.levels?.length ?? 0;

		let banked = 0;
		for (const item of source.items ?? []) {
			for (const rule of item.system?.rules ?? []) {
				if (rule?.type !== 'maxHpBonus') continue;

				// Deliberately not gated on `disabled` or on the predicate: the old
				// `preCreate` banked unconditionally, so a rule that is disabled or
				// non-matching today still has an amount sitting in the stored bonus.
				const value = Number(rule.value) || 0;
				banked += rule.perLevel ? value * level : value;
			}
		}

		if (banked === 0) return;

		const stored = Number(hp.bonus) || 0;
		hp.bonus = Math.max(0, stored - banked);

		console.log(
			`Nimble Migration | ${source.name}: removed ${banked} banked maxHpBonus HP from the stored bonus (${stored} -> ${hp.bonus}); rule bonuses are now derived`,
		);
	}
}

export { Migration044MaxHpBonusDerived };
