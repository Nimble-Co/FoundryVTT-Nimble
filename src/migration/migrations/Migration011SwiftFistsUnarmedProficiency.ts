import { UNARMED_STRIKE_PROFICIENCY } from '../../view/sheets/components/attackUtils.js';
import { MigrationBase } from '../MigrationBase.js';

const SWIFT_FISTS_SOURCE_ID = 'Compendium.nimble.class-features.Item.kHJVcWe64VhHsOFu';
const ZEPHYR_CLASS_SOURCE_ID = 'Compendium.nimble.classes.Item.OgeGMnmIkuDVb36X';

/**
 * Migration to update Zephyr unarmed strike mechanics:
 *
 * 1. Removes old unarmedDamage and grantProficiency rules from Swift Fists
 *    (Swift Fists now only affects rushed attack disadvantage and crit eligibility via description)
 *
 * 2. Adds 'unarmed' to Zephyr class weaponProficiencies
 *    (The class itself now grants unarmed weapon proficiency)
 */
class Migration011SwiftFistsUnarmedProficiency extends MigrationBase {
	static override readonly version = 11;

	override readonly version = Migration011SwiftFistsUnarmedProficiency.version;

	override async updateItem(source: any): Promise<void> {
		// Handle Swift Fists feature - remove old rules
		if (source.type === 'feature') {
			const isSwiftFists = source.flags?.core?.sourceId === SWIFT_FISTS_SOURCE_ID;

			if (isSwiftFists) {
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
		}

		// Handle Zephyr class - add Unarmed Strike proficiency
		if (source.type === 'class') {
			const isZephyr = source.flags?.core?.sourceId === ZEPHYR_CLASS_SOURCE_ID;

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
