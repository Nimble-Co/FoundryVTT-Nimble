/**
 * Structural shapes for the equipment an actor carries. Declared locally rather
 * than importing the document classes so the attack panels, the inventory tab
 * and the item documents can all use these without an import cycle.
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

/** Whether `weapon` can be attacked with: a weapon must be equipped, anything else always can. */
export function canAttackWith(weapon: WeaponItem): boolean {
	return weapon.system.objectType !== 'weapon' || weapon.system.equipped;
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
