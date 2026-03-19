import { MigrationBase } from '../MigrationBase.js';

const SWIFT_FISTS_SOURCE_ID = 'Compendium.nimble.class-features.Item.kHJVcWe64VhHsOFu';

const UNARMED_DAMAGE_RULE = {
	id: 'swift-fists-unarmed-damage',
	type: 'unarmedDamage',
	label: 'Swift Fists',
	value: '1d4 + @abilities.strength.mod',
};

/**
 * Migration to add unarmedDamage rule to Swift Fists feature items.
 *
 * The Swift Fists feature (Zephyr class) modifies unarmed strike damage:
 * - Core rules: "roll 1d4; on hit: deal 1 + STR damage"
 * - Swift Fists: "damage is 1d4+STR"
 *
 * This migration adds the unarmedDamage rule to existing Swift Fists feature items on actors.
 */
class Migration010SwiftFistsUnarmedDamage extends MigrationBase {
	static override readonly version = 10;

	override readonly version = Migration010SwiftFistsUnarmedDamage.version;

	override async updateItem(source: any): Promise<void> {
		// Only process feature items
		if (source.type !== 'feature') return;

		// Check if this is the Swift Fists feature by sourceId
		// Name-only matching is avoided to prevent false positives with homebrew items
		const isSwiftFists = source.flags?.core?.sourceId === SWIFT_FISTS_SOURCE_ID;

		if (!isSwiftFists) return;

		// Initialize rules array if it doesn't exist
		if (!source.system.rules) {
			source.system.rules = [];
		}

		// Check if rule already exists
		const hasUnarmedDamageRule = source.system.rules.some(
			(rule: any) => rule.type === 'unarmedDamage',
		);

		// Add missing rule
		if (!hasUnarmedDamageRule) {
			source.system.rules.push(UNARMED_DAMAGE_RULE);
			console.log(`Nimble Migration | ${source.name}: added Swift Fists unarmed damage rule`);
		}

		// Also ensure identifier is set
		if (!source.system.identifier) {
			source.system.identifier = 'swift-fists';
		}
	}
}

export { Migration010SwiftFistsUnarmedDamage };
