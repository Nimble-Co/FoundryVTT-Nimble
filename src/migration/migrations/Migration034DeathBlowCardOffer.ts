import { MigrationBase } from '../MigrationBase.js';

const DEATH_BLOW_SOURCE_IDS = new Set([
	'Compendium.nimble.class-features.Item.Dh6d5Ck3AAiRwQLB',
	'Compendium.nimble.nimble-class-features.Item.Dh6d5Ck3AAiRwQLB',
]);
const DEATH_BLOW_NAME = 'Death Blow';
const DEATH_BLOW_RULE_ID = 'death-blow-fury-consumer';

const RULES_ONLY_DESCRIPTION =
	'<p>After you deal damage from a crit, you may expend any number of Fury Dice. Sum the dice and deal double that amount of damage.</p>';

/**
 * Offer Death Blow on the crit that triggers it.
 *
 * Its `diceConsumer` could only be spent through the sheet's dice pool panel,
 * which posted the bonus as a standalone roll with no target and no Apply
 * Damage button. The GM had to read the number off that card and apply it by
 * hand, and applying it as a second hit would have re-run the target's armour
 * and flat reductions against the same attack.
 *
 * `cardOffer` puts the spend on the attack card instead, so this migration
 * backfills it on copies already living on actors or in world items.
 *
 * The guard is on a *truthy* `cardOffer` rather than the key's presence:
 * `cardOffer` is a schema field defaulting to `null`, so any embedded copy
 * re-saved after the system upgrade but before this migration runs would
 * already carry an explicit `null` and be skipped forever. Re-stamping an
 * explicit `null` is harmless — it is indistinguishable from never having been
 * migrated — while a GM who chose `hit` keeps their choice.
 */
class Migration034DeathBlowCardOffer extends MigrationBase {
	static override readonly version = 34;

	override readonly version = Migration034DeathBlowCardOffer.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const sourceId = this.getSourceId(source);
		const isDeathBlow =
			(sourceId && DEATH_BLOW_SOURCE_IDS.has(sourceId)) || source.name === DEATH_BLOW_NAME;
		if (!isDeathBlow) return;

		source.system.description = RULES_ONLY_DESCRIPTION;

		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		for (const rule of rules) {
			if (rule?.type !== 'diceConsumer') continue;
			if (rule.id !== DEATH_BLOW_RULE_ID) continue;
			if (rule.cardOffer) continue;

			rule.cardOffer = 'criticalHit';

			console.log(`Nimble Migration | ${source.name}: offer the Fury spend on critical hits`);
		}
	}
}

export { Migration034DeathBlowCardOffer };
