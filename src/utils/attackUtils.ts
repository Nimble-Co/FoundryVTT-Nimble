import { Predicate } from '../etc/Predicate.js';
import type {
	DamageBonusDelivery,
	DamageBonusEntry,
	DamageBonusSource,
} from '../models/rules/damageBonus.js';

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
 * Structural shape for an actor that may carry the proficiency / unarmed
 * extensions. Defined locally rather than importing `NimbleCharacter` to
 * avoid a cycle: `attackUtils` is consumed by `ItemActivationManager` which
 * is itself reachable from `character.ts`.
 */
type ProficiencyActor = { system: CharacterSystemExtension };

/**
 * Get the character system data with unarmed extensions
 */
export function getCharacterSystem(actor: ProficiencyActor): CharacterSystemExtension {
	return actor.system;
}

/**
 * Get the unarmed damage formula for the actor
 */
export function getUnarmedDamageFormula(actor: ProficiencyActor): string {
	return getCharacterSystem(actor).unarmedDamage ?? DEFAULT_UNARMED_DAMAGE;
}

/**
 * Check if the actor has weapon proficiency in unarmed strikes
 */
export function hasUnarmedProficiency(actor: ProficiencyActor): boolean {
	const weapons = getCharacterSystem(actor).proficiencies?.weapons;
	if (!weapons) return false;
	if (weapons instanceof Set) return weapons.has(UNARMED_STRIKE_PROFICIENCY);
	return Array.isArray(weapons) && weapons.includes(UNARMED_STRIKE_PROFICIENCY);
}

/**
 * Check whether an actor is proficient with a given weapon item.
 *
 * A wielder lacking proficiency in this weapon's type cannot crit.
 *
 * Behavior:
 * - If the weapon has no `weaponType` (empty string or unset), returns true
 *   regardless of actor. This is the permissive migration baseline so existing
 *   weapons that have not opted in to a weaponType keep working unchanged.
 * - Otherwise, returns true only if the actor has
 *   `system.proficiencies.weapons` (as a Set or string array) containing the
 *   weapon's `weaponType`.
 * - Returns false for a null actor, an actor with no `proficiencies.weapons`
 *   field (including monsters/NPCs), or an actor whose proficiency list does
 *   not include the weapon's type.
 */
export function hasWeaponProficiency(
	actor: { system?: unknown } | null | undefined,
	weapon: { system?: { weaponType?: string } } | null | undefined,
): boolean {
	const weaponType = weapon?.system?.weaponType ?? '';
	if (weaponType === '') return true; // permissive baseline
	const system = actor?.system as CharacterSystemExtension | undefined;
	const weapons = system?.proficiencies?.weapons;
	if (!weapons) return false;
	if (weapons instanceof Set) return weapons.has(weaponType);
	return Array.isArray(weapons) && weapons.includes(weaponType);
}

/**
 * Check if a bonus matches the given delivery, source, damage type, and target condition filters.
 */
function matchesBonus(
	bonus: DamageBonusEntry,
	delivery: DamageBonusDelivery,
	source: DamageBonusSource,
	damageType?: string,
	targetDomain?: Set<string>,
): boolean {
	if (bonus.delivery !== 'any' && bonus.delivery !== delivery) return false;
	if (bonus.source !== 'any' && bonus.source !== source) return false;
	if (bonus.damageType !== '' && damageType && bonus.damageType !== damageType) return false;
	if (bonus.targetCondition && Object.keys(bonus.targetCondition).length > 0) {
		if (!targetDomain) return false;
		// Predicate is reconstructed per call. At typical bonus counts (1–5) this
		// is negligible; caching on the entry is an option if profiling shows need.
		const predicate = new Predicate(bonus.targetCondition);
		if (!predicate.test(targetDomain)) return false;
	}
	return true;
}

/**
 * Sum all numeric damage bonuses on an actor that match the given filters.
 * Dice-based bonuses are excluded — use getDamageBonusFormulas() for those.
 *
 * @param actor - The actor whose `system.damageBonuses` array to read
 * @param delivery - The delivery method ('melee', 'ranged', or 'any')
 * @param source - The source type ('weapon', 'spell', or 'any')
 * @param damageType - Optional damage type to filter by (e.g. 'lightning')
 * @param targetDomain - Optional target actor domain for targetCondition evaluation
 * @returns The total numeric bonus value (0 if no matching bonuses)
 */
export function getDamageBonusTotal(
	actor: { system?: unknown } | null | undefined,
	delivery: DamageBonusDelivery,
	source: DamageBonusSource,
	damageType?: string,
	targetDomain?: Set<string>,
): number {
	const bonuses = (actor?.system as { damageBonuses?: DamageBonusEntry[] } | undefined)
		?.damageBonuses;
	if (!bonuses || bonuses.length === 0) return 0;

	let total = 0;
	for (const bonus of bonuses) {
		if (!bonus.value) continue;
		if (!matchesBonus(bonus, delivery, source, damageType, targetDomain)) continue;
		total += bonus.value;
	}
	return total;
}

/**
 * Collect all dice-based damage bonus formulas on an actor that match the given filters.
 * Numeric bonuses are excluded — use getDamageBonusTotal() for those.
 *
 * @param actor - The actor whose `system.damageBonuses` array to read
 * @param delivery - The delivery method ('melee', 'ranged', or 'any')
 * @param source - The source type ('weapon', 'spell', or 'any')
 * @param damageType - Optional damage type to filter by (e.g. 'lightning')
 * @param targetDomain - Optional target actor domain for targetCondition evaluation
 * @returns Array of dice formula strings to append to the damage roll
 */
export function getDamageBonusFormulas(
	actor: { system?: unknown } | null | undefined,
	delivery: DamageBonusDelivery,
	source: DamageBonusSource,
	damageType?: string,
	targetDomain?: Set<string>,
): string[] {
	const bonuses = (actor?.system as { damageBonuses?: DamageBonusEntry[] } | undefined)
		?.damageBonuses;
	if (!bonuses || bonuses.length === 0) return [];

	const formulas: string[] = [];
	for (const bonus of bonuses) {
		if (!bonus.formula) continue;
		if (!matchesBonus(bonus, delivery, source, damageType, targetDomain)) continue;
		formulas.push(bonus.formula);
	}
	return formulas;
}
