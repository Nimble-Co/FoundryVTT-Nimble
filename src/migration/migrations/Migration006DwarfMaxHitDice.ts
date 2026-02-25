import { MigrationBase } from '../MigrationBase.js';

const DWARF_SOURCE_ID = 'Compendium.nimble.ancestries.Item.hyVaEOLNSagYECwm';

const STOUT_MAX_HIT_DICE_RULE = {
	type: 'maxHitDice',
	label: 'Stout',
	value: '2',
	dieSize: 0,
};

/**
 * Migration to add max hit dice rule to Dwarf ancestry items.
 *
 * The Dwarf ancestry has a "Stout" trait that should:
 * - Grant +2 max Hit Dice
 *
 * This migration adds the maxHitDice rule to existing Dwarf ancestry items on actors.
 */
class Migration006DwarfMaxHitDice extends MigrationBase {
	static override readonly version = 6;

	override readonly version = Migration006DwarfMaxHitDice.version;

	override async updateItem(source: any): Promise<void> {
		// Only process ancestry items
		if (source.type !== 'ancestry') return;

		// Check if this is the Dwarf ancestry by sourceId or name
		const isDwarf = source.flags?.core?.sourceId === DWARF_SOURCE_ID || source.name === 'Dwarf';

		if (!isDwarf) return;

		// Initialize rules array if it doesn't exist
		if (!source.system.rules) {
			source.system.rules = [];
		}

		// Check if rule already exists
		const hasMaxHitDiceRule = source.system.rules.some(
			(rule: any) => rule.type === 'maxHitDice' && rule.label === 'Stout',
		);

		// Add missing rule
		if (!hasMaxHitDiceRule) {
			source.system.rules.push(STOUT_MAX_HIT_DICE_RULE);
			console.log(`Nimble Migration | ${source.name}: added Stout max hit dice rule`);
		}
	}
}

export { Migration006DwarfMaxHitDice };
