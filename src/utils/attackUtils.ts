import type { NimbleCharacter } from '../documents/actor/character.js';

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
