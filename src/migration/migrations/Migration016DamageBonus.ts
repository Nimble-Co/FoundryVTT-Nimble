import { MigrationBase } from '../MigrationBase.js';

/**
 * Migration to convert `meleeDamageBonus` rules to the generalized `damageBonus` type.
 *
 * `meleeDamageBonus` was a narrow rule type that only applied to melee attacks.
 * `damageBonus` generalizes this with separate `delivery` and `source` fields
 * that independently scope the bonus by how the attack reaches the target
 * (melee/ranged) and what produces the attack (weapon/spell).
 *
 * This migration rewrites `{ type: 'meleeDamageBonus' }` rules to
 * `{ type: 'damageBonus', delivery: 'melee', source: 'any' }`, preserving
 * all other fields.
 */
class Migration016DamageBonus extends MigrationBase {
	static override readonly version = 16;

	override readonly version = Migration016DamageBonus.version;

	override async updateItem(source: any): Promise<void> {
		const rules: any[] | undefined = source.system?.rules;
		if (!Array.isArray(rules)) return;

		for (const rule of rules) {
			if (rule.type !== 'meleeDamageBonus') continue;

			rule.type = 'damageBonus';
			rule.delivery = 'melee';
			rule.source = 'weapon';
			delete rule.appliesTo;

			// eslint-disable-next-line no-console
			console.log(`Nimble Migration | ${source.name}: converted meleeDamageBonus to damageBonus`);
		}
	}
}

export { Migration016DamageBonus };
