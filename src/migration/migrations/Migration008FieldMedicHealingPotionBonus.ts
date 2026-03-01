import { MigrationBase } from '../MigrationBase.js';

const FIELD_MEDIC_SOURCE_ID = 'Compendium.nimble.class-features.Item.KyQivlTfzYYudgsT';

const HEALING_POTION_BONUS_RULE = {
	id: 'fieldMedicHealingPotionBonus',
	type: 'healingPotionBonus',
	value: '1',
	label: 'Field Medic',
};

/**
 * Migration to add healingPotionBonus rule to Field Medic feature items.
 *
 * The Field Medic feature has a passive ability that should:
 * - Grant +1 bonus die when administering healing potions
 *
 * This migration adds the healingPotionBonus rule to existing Field Medic feature items on actors.
 */
class Migration008FieldMedicHealingPotionBonus extends MigrationBase {
	static override readonly version = 8;

	override readonly version = Migration008FieldMedicHealingPotionBonus.version;

	override async updateItem(source: any): Promise<void> {
		// Only process feature items
		if (source.type !== 'feature') return;

		// Check if this is the Field Medic feature by sourceId or name
		const isFieldMedic =
			source.flags?.core?.sourceId === FIELD_MEDIC_SOURCE_ID || source.name === 'Field Medic';

		if (!isFieldMedic) return;

		// Initialize rules array if it doesn't exist
		if (!source.system.rules) {
			source.system.rules = [];
		}

		// Check if rule already exists
		const hasHealingPotionBonusRule = source.system.rules.some(
			(rule: any) => rule.type === 'healingPotionBonus' && rule.label === 'Field Medic',
		);

		// Add missing rule
		if (!hasHealingPotionBonusRule) {
			source.system.rules.push(HEALING_POTION_BONUS_RULE);
			console.log(`Nimble Migration | ${source.name}: added Field Medic healing potion bonus rule`);
		}
	}
}

export { Migration008FieldMedicHealingPotionBonus };
