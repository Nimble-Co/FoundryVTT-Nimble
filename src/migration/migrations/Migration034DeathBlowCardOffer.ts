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
 * The description this feature shipped with before the card offer existed. Only
 * this exact text is replaced: matching it is what tells our copy apart from one
 * a GM has since rewritten, which is theirs to keep.
 */
const SUPERSEDED_DESCRIPTION =
	'<p>After you deal damage from a crit, you may expend any number of Fury Dice. Sum the dice and deal double that amount of damage.</p><p><em>Click this feature after dealing crit damage to spend Fury Dice. The chat card shows the bonus damage to apply.</em></p>';

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
 *
 * Identification needs both the name-or-source-id match and our own rule id:
 * the name alone would let an unrelated homebrew feature called "Death Blow"
 * have its description rewritten.
 */
class Migration034DeathBlowCardOffer extends MigrationBase {
	static override readonly version = 34;

	override readonly version = Migration034DeathBlowCardOffer.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		if (!source.system || typeof source.system !== 'object') return;

		const rules = source.system.rules;
		if (!Array.isArray(rules)) return;

		const rule = rules.find((r) => r?.type === 'diceConsumer' && r?.id === DEATH_BLOW_RULE_ID);
		if (!rule) return;

		const sourceId = this.getSourceId(source);
		const isDeathBlow =
			(sourceId && DEATH_BLOW_SOURCE_IDS.has(sourceId)) || source.name === DEATH_BLOW_NAME;
		if (!isDeathBlow) return;

		if (!rule.cardOffer) {
			rule.cardOffer = 'criticalHit';

			console.log(`Nimble Migration | ${source.name}: offer the Fury spend on critical hits`);
		}

		// The old description told the player to click the feature on the sheet,
		// which is no longer where the spend lives.
		if (source.system.description === SUPERSEDED_DESCRIPTION) {
			source.system.description = RULES_ONLY_DESCRIPTION;
		}
	}
}

export { Migration034DeathBlowCardOffer };
