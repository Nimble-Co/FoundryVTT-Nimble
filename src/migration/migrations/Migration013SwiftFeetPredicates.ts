import { MigrationBase } from '../MigrationBase.js';

const SWIFT_FEET_SOURCE_ID = 'Compendium.nimble.class-features.Item.idKzxuxGapLyV4sP';

const UPDATED_RULES = [
	{
		type: 'speedBonus',
		value: '2',
		label: 'Swift Feet (2)',
		predicate: {
			armor: 'unarmored',
		},
	},
	{
		type: 'initiativeBonus',
		value: '@level',
		label: 'Swift Feet Initiative Bonus',
		predicate: {
			armor: 'unarmored',
		},
	},
	{
		type: 'speedBonus',
		value: '2',
		label: 'Swift Feet (9)',
		predicate: {
			armor: 'unarmored',
			level: { min: 9 },
		},
	},
];

/**
 * Migration to update Swift Feet feature with proper unarmored predicates.
 *
 * The Swift Feet feature (Zephyr class) provides bonuses while unarmored:
 * - +2 speed while unarmored (level 2+)
 * - +LVL initiative while unarmored
 * - +2 additional speed while unarmored (level 9+)
 *
 * This migration updates the predicate format from the invalid `{ unarmored: true }`
 * to the correct `{ armor: "unarmored" }` format that works with the predicate system.
 * It also updates the level check from `{ level: 9 }` to `{ level: { min: 9 } }`.
 */
class Migration013SwiftFeetPredicates extends MigrationBase {
	static override readonly version = 13;

	override readonly version = Migration013SwiftFeetPredicates.version;

	override async updateItem(source: any): Promise<void> {
		// Only process feature items
		if (source.type !== 'feature') return;

		// Check if this is the Swift Feet feature by sourceId or by name
		const sourceId = this.getSourceId(source);
		const isSwiftFeetBySourceId = sourceId === SWIFT_FEET_SOURCE_ID;
		const isSwiftFeetByName = source.name === 'Swift Feet';

		// For name-based matching, verify it has the expected rule structure
		const hasExpectedRules =
			isSwiftFeetByName &&
			source.system.rules?.some(
				(rule: any) => rule.type === 'speedBonus' || rule.type === 'initiativeBonus',
			);

		if (!isSwiftFeetBySourceId && !hasExpectedRules) return;

		// Check if migration is needed by looking for old predicate format or missing predicates
		const needsMigration = source.system.rules?.some(
			(rule: any) =>
				rule.predicate?.unarmored === true ||
				(rule.predicate?.level !== undefined && typeof rule.predicate.level === 'number') ||
				(rule.label === 'Swift Feet' && rule.type === 'speedBonus'),
		);

		if (!needsMigration) return;

		// Replace all rules with updated versions
		source.system.rules = UPDATED_RULES;

		console.log(`Nimble Migration | ${source.name}: updated Swift Feet predicates`);
	}
}

export { Migration013SwiftFeetPredicates };
