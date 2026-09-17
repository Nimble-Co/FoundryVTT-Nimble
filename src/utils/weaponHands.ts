/** Hands a character has before a feature or magic item grants more. */
export const BASE_HAND_COUNT = 2;

/** Extra hands granted by the `extraHands` rule live here. */
export const EXTRA_HANDS_PATH = 'attributes.extraHands';

/** Object types that take up a hand while equipped. Armor does not. */
const HAND_OCCUPYING_TYPES = new Set(['weapon', 'shield']);

export function occupiesHand(item: HandItem): boolean {
	return HAND_OCCUPYING_TYPES.has(item.system.objectType);
}

/**
 * Structural shapes for the equipment an actor holds. Declared locally rather
 * than importing the document classes so the attack panels, the inventory tab
 * and the character document can all use these without an import cycle.
 */
export interface HandItem {
	id: string | null;
	name: string | null;
	type: string;
	system: {
		objectType: string;
		equipped: boolean;
		weaponType?: string;
		properties: {
			selected: string[];
			strengthRequirement: { value: number | null; overridesTwoHanded: boolean };
		};
	};
}

export interface EquipmentActor {
	items: { filter(predicate: (item: any) => boolean): any[] };
	system: {
		abilities?: { strength?: { mod?: number } };
		attributes?: { extraHands?: number; equipmentSwapBonus?: number };
	};
}

export function getHandCount(actor: EquipmentActor): number {
	return BASE_HAND_COUNT + Math.max(0, actor.system.attributes?.extraHands ?? 0);
}

/**
 * The weapons and shields the character is holding. A two-handed weapon counts
 * once: the book lets it be held in a single hand and only asks for the second
 * at the moment of attacking.
 */
export function getHeldItems(actor: EquipmentActor): HandItem[] {
	return actor.items.filter((item) => {
		if (item.type !== 'object') return false;
		return HAND_OCCUPYING_TYPES.has(item.system.objectType) && item.system.equipped;
	});
}

export function getFreeHandCount(actor: EquipmentActor): number {
	return Math.max(0, getHandCount(actor) - getHeldItems(actor).length);
}

export function getStrengthModifier(actor: EquipmentActor): number {
	return Number(actor.system.abilities?.strength?.mod ?? 0);
}
