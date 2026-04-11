import { UNARMED_STRIKE_PROFICIENCY } from '../../utils/attackUtils.js';
import { MigrationBase } from '../MigrationBase.js';

const SWIFT_FISTS_SOURCE_ID = 'Compendium.nimble.class-features.Item.kHJVcWe64VhHsOFu';
const ZEPHYR_CLASS_SOURCE_ID = 'Compendium.nimble.classes.Item.OgeGMnmIkuDVb36X';
const REVERBERATING_STRIKES_SOURCE_ID = 'Compendium.nimble.class-features.Item.2gSHmIA0PE65YleM';

const REVERBERATING_STRIKES_RULE = {
	id: 'reverberating-strikes-melee-damage',
	type: 'meleeDamageBonus',
	label: 'Reverberating Strikes',
	value: '@level',
	damageType: 'bludgeoning',
};

/**
 * Migration to update Zephyr class features:
 *
 * 1. Removes old unarmedDamage and grantProficiency rules from Swift Fists
 *
 * 2. Adds 'Unarmed Strike' to Zephyr class weaponProficiencies
 *
 * 3. Adds meleeDamageBonus rule to Reverberating Strikes
 */
class Migration011SwiftFistsUnarmedProficiency extends MigrationBase {
	static override readonly version = 11;

	override readonly version = Migration011SwiftFistsUnarmedProficiency.version;

	override async updateItem(source: any): Promise<void> {
		// Handle feature items
		if (source.type === 'feature') {
			const sourceId = this.getSourceId(source);

			// Swift Fists - remove old rules
			if (sourceId === SWIFT_FISTS_SOURCE_ID) {
				if (!source.system.rules) {
					source.system.rules = [];
				}

				// Remove any unarmedDamage or grantProficiency rules
				const originalLength = source.system.rules.length;
				source.system.rules = source.system.rules.filter(
					(rule: any) =>
						rule.type !== 'unarmedDamage' &&
						!(
							rule.type === 'grantProficiency' &&
							rule.proficiencyType === 'weapons' &&
							(rule.values?.includes('unarmed') ||
								rule.values?.includes(UNARMED_STRIKE_PROFICIENCY))
						),
				);

				if (source.system.rules.length < originalLength) {
					console.log(
						`Nimble Migration | ${source.name}: removed unarmed rules (proficiency now on class)`,
					);
				}
			}

			// Reverberating Strikes - add meleeDamageBonus rule
			if (sourceId === REVERBERATING_STRIKES_SOURCE_ID) {
				if (!source.system.rules) {
					source.system.rules = [];
				}

				const hasMeleeDamageBonusRule = source.system.rules.some(
					(rule: any) => rule.type === 'meleeDamageBonus',
				);

				if (!hasMeleeDamageBonusRule) {
					source.system.rules.push(REVERBERATING_STRIKES_RULE);
					console.log(`Nimble Migration | ${source.name}: added meleeDamageBonus rule`);
				}
			}
		}

		// Handle Zephyr class - add Unarmed Strike proficiency
		if (source.type === 'class') {
			const isZephyr = this.getSourceId(source) === ZEPHYR_CLASS_SOURCE_ID;

			if (isZephyr) {
				if (!source.system.weaponProficiencies) {
					source.system.weaponProficiencies = [];
				}

				if (!source.system.weaponProficiencies.includes(UNARMED_STRIKE_PROFICIENCY)) {
					source.system.weaponProficiencies.push(UNARMED_STRIKE_PROFICIENCY);
					console.log(
						`Nimble Migration | ${source.name}: added ${UNARMED_STRIKE_PROFICIENCY} weapon proficiency`,
					);
				}
			}
		}
	}
}

export { Migration011SwiftFistsUnarmedProficiency };
