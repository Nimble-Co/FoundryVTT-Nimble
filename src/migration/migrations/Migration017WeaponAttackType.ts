import { MigrationBase } from '../MigrationBase.js';

/**
 * Migration to set `attackType` on all weapon items.
 *
 * Weapons need `system.activation.targets.attackType` set so that damage
 * bonus rules (damageBonus) can filter by delivery method (melee/ranged).
 * Previously this field was unset on all weapons, defaulting to empty string.
 *
 * Logic: if the weapon has 'range' in its selected properties, set attackType
 * to 'range'. Otherwise set to 'reach' (melee). Skip if attackType is already
 * set to a non-empty value.
 */
class Migration017WeaponAttackType extends MigrationBase {
	static override readonly version = 17;

	override readonly version = Migration017WeaponAttackType.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'object') return;
		if (source.system?.objectType !== 'weapon') return;

		const attackType = source.system?.activation?.targets?.attackType;
		if (attackType && attackType !== '') return;

		const selected: string[] = source.system?.properties?.selected ?? [];
		const isRanged = selected.includes('range');

		if (!source.system.activation) source.system.activation = {};
		if (!source.system.activation.targets) source.system.activation.targets = {};
		source.system.activation.targets.attackType = isRanged ? 'range' : 'reach';

		// eslint-disable-next-line no-console
		console.log(
			`Nimble Migration | ${source.name}: set attackType to '${source.system.activation.targets.attackType}'`,
		);
	}
}

export { Migration017WeaponAttackType };
