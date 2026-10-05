/**
 * Structural shapes for the equipment an actor carries. Declared locally rather
 * than importing the document classes so the attack panels, the inventory tab
 * and the character document can all use these without an import cycle.
 */
export interface WeaponItem {
	id: string | null;
	name: string | null;
	type: string;
	system: {
		objectType: string;
		equipped: boolean;
		properties: {
			selected: string[];
			strengthRequirement?: { value: number | null; overridesTwoHanded: boolean };
		};
	};
}

export interface EquipmentActor {
	system: {
		abilities?: { strength?: { mod?: number } };
	};
}

export type WeaponAttackRefusal = 'notEquipped';

export interface WeaponAttackCheck {
	allowed: boolean;
	refusal?: WeaponAttackRefusal;
}

/**
 * Whether `weapon` can be attacked with right now.
 *
 * Being equipped is the only hard condition: a weapon you are not holding is
 * not one you can swing. A Strength requirement is surfaced as a notice
 * instead, see `getStrengthShortfall`, because the book leaves what an
 * under-strength hero may do with the weapon to the table.
 */
export function checkWeaponAttack(weapon: WeaponItem): WeaponAttackCheck {
	if (weapon.system.objectType !== 'weapon') return { allowed: true };
	if (!weapon.system.equipped) return { allowed: false, refusal: 'notEquipped' };

	return { allowed: true };
}

export function getStrengthModifier(actor: EquipmentActor): number {
	return Number(actor.system.abilities?.strength?.mod ?? 0);
}

/**
 * How far short of a weapon's Strength requirement the character falls, or
 * `null` when nothing is owed.
 *
 * `strengthRequirement.value` means two different things depending on the
 * boolean beside it. With `overridesTwoHanded` it buys one-handed use of a
 * two-handed weapon (the Longsword), so missing it costs nothing: the weapon
 * is simply used in two hands. Without it the requirement is a flat condition
 * on using the weapon at all (the great weapons, the Handheld Ballista, the
 * Longbow), and that is what the notice reports.
 */
export function getStrengthShortfall(
	actor: EquipmentActor,
	weapon: WeaponItem,
): { required: number; current: number } | null {
	const { objectType, properties } = weapon.system;
	if (objectType !== 'weapon') return null;

	const { value = null, overridesTwoHanded = false } = properties.strengthRequirement ?? {};
	if (overridesTwoHanded || value === null) return null;

	const current = getStrengthModifier(actor);
	if (current >= value) return null;

	return { required: value, current };
}
