import {
	type EquipmentActor,
	getFreeHandCount,
	getHeldItems,
	getStrengthModifier,
	type HandItem,
	occupiesHand,
} from './weaponHands.js';

export type EquipRefusal = 'noFreeHand' | 'dualWieldStrength';

export interface EquipCheck {
	allowed: boolean;
	refusal?: EquipRefusal;
	/** The strength the combination asks for, when that is what failed. */
	strengthRequired?: number;
}

/** Strength to dual wield when one of the two weapons lacks the Light property. */
const ONE_NON_LIGHT_STRENGTH = 2;

/** Strength to dual wield when neither weapon has the Light property. */
const TWO_NON_LIGHT_STRENGTH = 3;

function isOneHandedWeapon(item: HandItem): boolean {
	return (
		item.system.objectType === 'weapon' && !item.system.properties.selected.includes('twoHanded')
	);
}

function isLight(item: HandItem): boolean {
	return item.system.properties.selected.includes('light');
}

/**
 * Whether `item` can be equipped alongside what the character already holds.
 *
 * Two clauses apply. A hand has to be free, and equipping never takes something
 * else off, because which item to put away is the player's call. Then dual
 * wielding: "Heroes may wield 2 Light weapons at the same time... You may dual
 * wield 1-handed weapons without the Light property if your STR is 3 or
 * greater, or 1 weapon without the Light property if your STR is 2."
 */
export default function checkEquip(actor: EquipmentActor, item: HandItem): EquipCheck {
	// Armor and trinkets are worn, not held, so they never compete for a hand.
	if (!occupiesHand(item)) return { allowed: true };

	if (getFreeHandCount(actor) < 1) return { allowed: false, refusal: 'noFreeHand' };

	if (!isOneHandedWeapon(item)) return { allowed: true };

	const oneHandedAfterEquip = [...getHeldItems(actor), item].filter(isOneHandedWeapon);
	if (oneHandedAfterEquip.length < 2) return { allowed: true };

	const nonLightCount = oneHandedAfterEquip.filter((weapon) => !isLight(weapon)).length;
	if (nonLightCount === 0) return { allowed: true };

	const strengthRequired = nonLightCount >= 2 ? TWO_NON_LIGHT_STRENGTH : ONE_NON_LIGHT_STRENGTH;
	if (getStrengthModifier(actor) >= strengthRequired) return { allowed: true };

	return { allowed: false, refusal: 'dualWieldStrength', strengthRequired };
}
