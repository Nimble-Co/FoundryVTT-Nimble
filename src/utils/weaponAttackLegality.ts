import localize from './localize.js';

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

/**
 * The warning for an equipped weapon whose Strength requirement the character
 * does not meet, or `null`. The requirement is reported, never enforced.
 *
 * With `overridesTwoHanded` the requirement buys one-handed use of a
 * two-handed weapon, so missing it costs nothing and there is no warning.
 */
export function getStrengthNotice(actor: EquipmentActor, weapon: WeaponItem): string | null {
	const { objectType, equipped, properties } = weapon.system;
	if (objectType !== 'weapon' || !equipped) return null;

	const { value = null, overridesTwoHanded = false } = properties.strengthRequirement ?? {};
	if (overridesTwoHanded || value === null) return null;

	const current = Number(actor.system.abilities?.strength?.mod ?? 0);
	if (current >= value) return null;

	return localize('NIMBLE.weapons.notices.strengthShortfall', {
		required: String(value),
		current: String(current),
	});
}
