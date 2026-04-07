import type { NimbleCharacter } from '../../../documents/actor/character.js';

/** Default unarmed: 1d4 + STR damage, but cannot crit without proficiency (e.g., Swift Fists) */
export const DEFAULT_UNARMED_DAMAGE = '1d4 + @abilities.strength.mod';

/** Weapon proficiency key for unarmed strikes */
export const UNARMED_STRIKE_PROFICIENCY = 'Unarmed Strike';

/** Extended character system data with optional unarmed damage and proficiencies */
export interface CharacterSystemExtension {
	unarmedDamage?: string;
	proficiencies?: {
		weapons?: Set<string> | string[];
	};
}

/**
 * Get the character system data with unarmed extensions
 */
export function getCharacterSystem(actor: NimbleCharacter): CharacterSystemExtension {
	return actor.system as CharacterSystemExtension;
}

/**
 * Get the unarmed damage formula for the actor
 */
export function getUnarmedDamageFormula(actor: NimbleCharacter): string {
	return getCharacterSystem(actor).unarmedDamage ?? DEFAULT_UNARMED_DAMAGE;
}

/**
 * Check if the actor has weapon proficiency in unarmed strikes
 */
export function hasUnarmedProficiency(actor: NimbleCharacter): boolean {
	const weapons = getCharacterSystem(actor).proficiencies?.weapons;
	if (!weapons) return false;
	if (weapons instanceof Set) return weapons.has(UNARMED_STRIKE_PROFICIENCY);
	return Array.isArray(weapons) && weapons.includes(UNARMED_STRIKE_PROFICIENCY);
}

/**
 * Check whether an actor is proficient with a given weapon item.
 *
 * Bug #8b: a wielder lacking proficiency in this weapon's type cannot crit.
 *
 * The check is permissive by default: weapons with `system.weaponType === ''`
 * (or unset) are treated as proficient for everyone. This is the migration
 * safety hatch — existing weapons that have not opted in to a weaponType keep
 * working unchanged. Only weapons with an explicit non-empty weaponType are
 * subject to the proficiency check.
 *
 * Non-character actors (monsters, NPCs without a proficiencies field) are
 * also treated as proficient — the restriction only meaningfully applies to
 * player characters.
 */
export function hasWeaponProficiency(
	actor: NimbleCharacter | { system?: unknown } | null | undefined,
	weapon: { system?: { weaponType?: string } } | null | undefined,
): boolean {
	const weaponType = weapon?.system?.weaponType ?? '';
	if (weaponType === '') return true; // permissive baseline
	const proficiencies = (actor as NimbleCharacter | undefined)?.system as
		| CharacterSystemExtension
		| undefined;
	const weapons = proficiencies?.proficiencies?.weapons;
	if (!weapons) return false;
	if (weapons instanceof Set) return weapons.has(weaponType);
	return Array.isArray(weapons) && weapons.includes(weaponType);
}
