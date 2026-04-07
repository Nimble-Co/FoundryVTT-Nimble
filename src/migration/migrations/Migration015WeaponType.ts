import { MigrationBase } from '../MigrationBase.js';

/**
 * Migration to add a `weaponType` string field to all object items.
 *
 * The per-weapon proficiency check suppresses crits when an actor lacks
 * proficiency with the weapon they're wielding. The check is gated on
 * `system.weaponType`, which previously did not exist on object items.
 *
 * This migration backfills the field with an empty string for every existing
 * object item. Empty string is the **permissive default** — `hasWeaponProficiency`
 * treats it as "no proficiency check applies, anyone can crit with this
 * weapon". Existing content therefore behaves identically to before; only
 * weapons explicitly opted in to a non-empty `weaponType` are subject to the
 * new check.
 *
 * Reversibility: removing the field rolls back the migration cleanly with no
 * data loss.
 */
class Migration015WeaponType extends MigrationBase {
	static override readonly version = 15;

	override readonly version = Migration015WeaponType.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'object') return;
		if (!source.system) return;
		if (typeof source.system.weaponType === 'string') return;
		source.system.weaponType = '';
	}
}

export { Migration015WeaponType };
