import { MigrationBase } from '../MigrationBase.js';

const OOZELING_CONSTRUCT_SOURCE_ID = 'Compendium.nimble.ancestries.Item.jYafwBbK4DVALpBf';

const ODD_CONSTITUTION_RULES = [
	{
		type: 'incrementHitDice',
		label: 'Odd Constitution',
		value: '1',
	},
	{
		type: 'maximizeHitDice',
		label: 'Odd Constitution',
	},
];

/**
 * Migration to add Odd Constitution rules to Oozeling/Construct ancestry items.
 *
 * The Oozeling/Construct ancestry has an "Odd Constitution" trait that should:
 * - Increment hit dice one step (d6 → d8 → d10 → d12 → d20)
 * - Make hit dice always heal for maximum amount
 *
 * This migration adds the incrementHitDice and maximizeHitDice rules to
 * existing Oozeling/Construct ancestry items on actors.
 */
class Migration003OozelingConstructRules extends MigrationBase {
	static override readonly version = 3;

	override readonly version = Migration003OozelingConstructRules.version;

	override async updateItem(source: any): Promise<void> {
		// Only process ancestry items
		if (source.type !== 'ancestry') return;

		// Check if this is the Oozeling/Construct ancestry by sourceId or name
		const isOozelingConstruct =
			source.flags?.core?.sourceId === OOZELING_CONSTRUCT_SOURCE_ID ||
			source.name === 'Oozeling/Construct';

		if (!isOozelingConstruct) return;

		// Initialize rules array if it doesn't exist
		if (!source.system.rules) {
			source.system.rules = [];
		}

		// Check if rules already exist
		const hasIncrementRule = source.system.rules.some(
			(rule: any) => rule.type === 'incrementHitDice' && rule.label === 'Odd Constitution',
		);
		const hasMaximizeRule = source.system.rules.some(
			(rule: any) => rule.type === 'maximizeHitDice' && rule.label === 'Odd Constitution',
		);

		// Add missing rules
		if (!hasIncrementRule) {
			source.system.rules.push(ODD_CONSTITUTION_RULES[0]);
		}
		if (!hasMaximizeRule) {
			source.system.rules.push(ODD_CONSTITUTION_RULES[1]);
		}

		if (!hasIncrementRule || !hasMaximizeRule) {
			console.log(`Nimble Migration | ${source.name}: added Odd Constitution rules`);
		}
	}
}

export { Migration003OozelingConstructRules };
