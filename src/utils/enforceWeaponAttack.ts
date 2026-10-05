import localize from './localize.js';
import { checkWeaponAttack, type WeaponItem } from './weaponAttackLegality.js';

/**
 * The single gate every weapon attack passes through. Refuses with a localized
 * notification naming the condition that failed.
 *
 * @returns whether the attack may proceed.
 */
export default function enforceWeaponAttack(weapon: WeaponItem): boolean {
	const check = checkWeaponAttack(weapon);
	if (check.allowed) return true;

	ui.notifications?.warn(
		localize(`NIMBLE.weapons.refusals.${check.refusal}`, { name: weapon.name ?? '' }),
	);

	return false;
}
