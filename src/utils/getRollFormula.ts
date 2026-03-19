import constructD20RollFormula from '../dice/constructD20RollFormula.js';
import { ModifierManager } from '../managers/ModifierManager.js';

/**
 * Generates a complete d20 roll formula for an actor based on roll configuration.
 *
 * This is a convenience function that combines ModifierManager and constructD20RollFormula
 * to produce a ready-to-use roll formula string. It:
 * 1. Creates a ModifierManager to collect all applicable modifiers
 * 2. Passes the modifiers to constructD20RollFormula along with roll options
 * 3. Returns the simplified, validated formula string
 *
 * @param actor - The actor making the roll.
 * @param rollData - Configuration specifying the roll type, relevant keys, and options.
 * @param rollData.type - The type of roll ('abilityCheck', 'savingThrow', 'skillCheck').
 * @param rollData.abilityKey - For ability checks, the ability to use (e.g., "str").
 * @param rollData.saveKey - For saving throws, the save type (e.g., "fortitude").
 * @param rollData.skillKey - For skill checks, the skill (e.g., "athletics").
 * @param rollData.rollMode - Advantage (positive), disadvantage (negative), or normal (0).
 * @param rollData.minRoll - Minimum d20 value (default 1).
 * @param rollData.item - Optional item providing additional context.
 * @returns The complete roll formula string (e.g., "2d20kh + 5[Strength] + 3[Athletics]").
 *
 * @example
 * ```typescript
 * // Strength check with advantage
 * const formula = getRollFormula(actor, {
 *   type: 'abilityCheck',
 *   abilityKey: 'str',
 *   rollMode: 1
 * });
 * // Returns something like "2d20kh + 3[Strength Mod]"
 *
 * // Fortitude save
 * const saveFormula = getRollFormula(actor, {
 *   type: 'savingThrow',
 *   saveKey: 'fortitude'
 * });
 * ```
 */
export default function getRollFormula(
	actor: NimbleBaseActor,
	rollData = {} as ModifierManager.RollDataOptions,
) {
	const modifierManager = new ModifierManager(actor, rollData);

	return constructD20RollFormula({
		actor,
		rollMode: rollData.rollMode ?? CONFIG.NIMBLE.ROLL_MODE.NORMAL,
		minRoll: rollData.minRoll ?? 1,
		item: rollData.item ?? undefined,
		modifiers: modifierManager.getModifiers(),
	}).rollFormula;
}
