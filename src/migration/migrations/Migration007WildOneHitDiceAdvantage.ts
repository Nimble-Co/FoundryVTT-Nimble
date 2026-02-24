import { MigrationBase } from '../MigrationBase.js';

const WILD_ONE_SOURCE_ID = 'Compendium.nimble.backgrounds.Item.LWkH3GfYt0uU8qDj';

const HIT_DICE_ADVANTAGE_RULE = {
	type: 'hitDiceAdvantage',
	label: 'Wild One',
	condition: 'in the wild',
};

/**
 * Migration to add hit dice advantage rule to Wild One background items.
 *
 * The Wild One background should:
 * - Grant hit dice advantage while field resting in the wild
 *
 * This migration adds the hitDiceAdvantage rule to existing Wild One background items on actors.
 */
class Migration007WildOneHitDiceAdvantage extends MigrationBase {
	static override readonly version = 7;

	override readonly version = Migration007WildOneHitDiceAdvantage.version;

	override async updateItem(source: any): Promise<void> {
		// Only process background items
		if (source.type !== 'background') return;

		// Check if this is the Wild One background by sourceId or name
		const isWildOne =
			source.flags?.core?.sourceId === WILD_ONE_SOURCE_ID || source.name === 'Wild One';

		if (!isWildOne) return;

		// Initialize rules array if it doesn't exist
		if (!source.system.rules) {
			source.system.rules = [];
		}

		// Check if rule already exists
		const hasHitDiceAdvantageRule = source.system.rules.some(
			(rule: any) => rule.type === 'hitDiceAdvantage' && rule.label === 'Wild One',
		);

		// Add missing rule
		if (!hasHitDiceAdvantageRule) {
			source.system.rules.push(HIT_DICE_ADVANTAGE_RULE);
			console.log(`Nimble Migration | ${source.name}: added hit dice advantage rule`);
		}
	}
}

export { Migration007WildOneHitDiceAdvantage };
