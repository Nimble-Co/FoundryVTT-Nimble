import { hasWeaponProficiency } from './attackUtils.js';
import { getEquipmentSwapsRemaining } from './equipmentSwaps.js';
import {
	type EquipmentActor,
	getFreeHandCount,
	getHeldItems,
	getStrengthModifier,
	type HandItem,
} from './weaponHands.js';

export type WeaponAttackRefusal =
	| 'notEquipped'
	| 'strengthRequirement'
	| 'noFreeHand'
	| 'noSwapsLeft';

export interface WeaponAttackCheck {
	allowed: boolean;
	refusal?: WeaponAttackRefusal;
	/** The strength the weapon asks for, when that is what failed. */
	strengthRequired?: number;
	/**
	 * Held items that could be sheathed to free the hand this attack needs.
	 * Empty unless taking the attack requires a swap.
	 */
	sheatheCandidates: HandItem[];
	/** Taking this attack must sheathe something and spend a swap. */
	requiresSwap: boolean;
}

interface CombatContext {
	combatant: Parameters<typeof getEquipmentSwapsRemaining>[1];
	combat: Parameters<typeof getEquipmentSwapsRemaining>[2];
}

function allow(): WeaponAttackCheck {
	return { allowed: true, sheatheCandidates: [], requiresSwap: false };
}

function refuse(refusal: WeaponAttackRefusal, strengthRequired?: number): WeaponAttackCheck {
	return { allowed: false, refusal, strengthRequired, sheatheCandidates: [], requiresSwap: false };
}

/** The free swap covers only weapons and shields the hero is proficient with. */
function canBeSheathedFreely(actor: EquipmentActor, held: HandItem): boolean {
	if (held.system.objectType !== 'weapon') return true;
	return hasWeaponProficiency(actor, held);
}

/**
 * Whether `weapon` can be attacked with right now, and what it would cost.
 *
 * The hand rules come from two book clauses. "2-handed: can be held in a single
 * hand, but must be wielded in 2 hands to attack with it" means a two-handed
 * weapon occupies one hand at rest and needs a second one free at the moment of
 * the attack. "Swapping Equipment: a hero can sheathe weapons or shields they
 * are proficient with and equip a different one for free 1/round" is what pays
 * for freeing that hand inline.
 *
 * `strengthRequirement.value` means two different things depending on the
 * boolean beside it: with `overridesTwoHanded` it gates wielding the weapon
 * one-handed (the Longsword), and without it gates using the weapon at all
 * (the great weapons, the Handheld Ballista, the Longbow).
 */
export function checkWeaponAttack(
	actor: EquipmentActor,
	weapon: HandItem,
	combatContext: CombatContext = { combatant: null, combat: null },
): WeaponAttackCheck {
	const { system } = weapon;
	if (system.objectType !== 'weapon') return allow();
	if (!system.equipped) return refuse('notEquipped');

	if (!system.properties.selected.includes('twoHanded')) return allow();

	const { value, overridesTwoHanded } = system.properties.strengthRequirement;
	const strength = getStrengthModifier(actor);

	if (overridesTwoHanded) {
		// The requirement buys one-handed use; two-handed use is unconditional.
		if (value !== null && strength >= value) return allow();
	} else if (value !== null && strength < value) {
		return refuse('strengthRequirement', value);
	}

	if (getFreeHandCount(actor) > 0) return allow();

	const sheatheCandidates = getHeldItems(actor).filter(
		(held) => held.id !== weapon.id && canBeSheathedFreely(actor, held),
	);
	if (sheatheCandidates.length === 0) return refuse('noFreeHand');

	if (getEquipmentSwapsRemaining(actor, combatContext.combatant, combatContext.combat) <= 0) {
		return refuse('noSwapsLeft');
	}

	return { allowed: true, sheatheCandidates, requiresSwap: true };
}
