import { MigrationBase } from '../MigrationBase.js';

/**
 * Fixes fury-dice pool rules on already-embedded items.
 *
 * Migration019 set poolMode='accumulate' for fury-dice, but the correct mode is
 * 'resource' (individual spendable pips, not an aggregated running total).
 *
 * Additionally backfills rollOnActivation and corrects the die-face level
 * overrides (d6 at 6, d8 at 9, d10 at 13, d12 at 17) which were only present
 * in the compendium JSON and not in already-embedded items.
 */
class Migration020RollOnActivation extends MigrationBase {
	static override readonly version = 20;

	override readonly version = Migration020RollOnActivation.version;

	override async updateItem(source: any): Promise<void> {
		const rules: any[] | undefined = source.system?.rules;
		if (!Array.isArray(rules)) return;

		for (const rule of rules) {
			if (rule.type !== 'dicePool') continue;
			if (rule.identifier === 'fury-dice') {
				rule.poolMode = 'individual';
				rule.rollOnActivation = true;
				// Fix die-size level overrides for the Intensifying Fury progression
				if (rule.levels) {
					rule.levels['6'] ??= {};
					rule.levels['9'] ??= {};
					rule.levels['13'] ??= {};
					rule.levels['17'] ??= {};
					rule.levels['6'].faces = 6;
					rule.levels['9'].faces = 8;
					rule.levels['13'].faces = 10;
					rule.levels['17'].faces = 12;
				}
			} else {
				rule.rollOnActivation ??= false;
			}
		}
	}
}

export { Migration020RollOnActivation };
