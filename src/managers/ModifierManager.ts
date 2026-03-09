// NimbleBaseActor and NimbleBaseItem types are available globally from .d.ts files

import localize from '../utils/localize.js';

declare namespace ModifierManager {
	/**
	 * Options specifying the type and context of a roll for modifier calculation.
	 */
	interface RollDataOptions {
		/** The ability key for ability checks (e.g., "str", "dex"). */
		abilityKey?: string;
		/** Optional item associated with the roll. */
		item?: NimbleBaseItem | undefined;
		/** Minimum roll value (e.g., for reliable talent). */
		minRoll?: number | undefined;
		/** Roll mode: positive for advantage, negative for disadvantage. */
		rollMode?: number | undefined;
		/** The save key for saving throws (e.g., "fortitude", "reflex"). */
		saveKey?: string | undefined;
		/** The skill key for skill checks (e.g., "athletics", "stealth"). */
		skillKey?: string | undefined;
		/** Additional situational modifiers as a formula string. */
		situationalMods?: string | undefined;
		/** The type of roll being made. */
		type: 'abilityCheck' | 'savingThrow' | 'skillCheck';
	}

	/**
	 * A modifier to be applied to a roll, with optional label for display.
	 */
	type Modifier = { label?: string | undefined; value: number | string };
}

/**
 * Manages the collection and calculation of modifiers for d20 rolls.
 *
 * ModifierManager builds appropriate modifier lists based on:
 * - Roll type (ability check, saving throw, skill check)
 * - Actor type (character, monster, solo monster)
 * - Relevant ability scores, saves, or skills
 * - Situational modifiers provided by the user
 *
 * Different actor types may have different modifier sources:
 * - Characters: Full ability modifiers, skill bonuses, save bonuses
 * - Solo Monsters: Simplified modifier structure
 *
 * @example
 * ```typescript
 * const manager = new ModifierManager(actor, {
 *   type: 'skillCheck',
 *   skillKey: 'athletics'
 * });
 * const modifiers = manager.getModifiers();
 * // modifiers might be [{ label: "Athletics", value: 5 }]
 * ```
 */
class ModifierManager {
	/** The actor whose modifiers are being calculated. */
	actor: NimbleBaseActor;

	/** The roll configuration specifying what type of roll and relevant keys. */
	rollData: ModifierManager.RollDataOptions;

	/**
	 * Creates a new ModifierManager.
	 *
	 * @param actor - The actor making the roll.
	 * @param rollData - Configuration specifying the roll type and relevant keys.
	 */
	constructor(actor: NimbleBaseActor, rollData: ModifierManager.RollDataOptions) {
		this.actor = actor;
		this.rollData = rollData;
	}

	/**
	 * Gets all applicable modifiers for the configured roll type.
	 *
	 * Returns different modifiers based on roll type:
	 * - abilityCheck: Ability modifier + situational
	 * - savingThrow: Save modifier + situational
	 * - skillCheck: Skill modifier + situational
	 *
	 * @returns Array of modifiers to apply to the roll, with null values filtered out.
	 */
	getModifiers(): ModifierManager.Modifier[] {
		switch (this.rollData.type) {
			case 'abilityCheck':
				return this.#getAbilityCheckModifiers().filter((m) => !!m);
			case 'savingThrow':
				return this.#getSavingThrowModifiers().filter((m) => !!m);
			case 'skillCheck':
				return this.#getSkillCheckModifiers().filter((m) => !!m);
			default:
				return [];
		}
	}

	/** -------------------------------------- */
	/**               Handlers                 */
	/** -------------------------------------- */

	/**
	 * Gets modifiers for an ability check.
	 * Solo monsters only get situational modifiers; others get ability + situational.
	 */
	#getAbilityCheckModifiers() {
		if (this.actor.isType('soloMonster')) {
			return [this.#getSituationalModifiers()];
		}

		return [this.#getAbilityModifier(), this.#getSituationalModifiers()];
	}

	/**
	 * Gets modifiers for a saving throw.
	 * Includes the save modifier and any situational modifiers.
	 */
	#getSavingThrowModifiers() {
		return [this.#getAbilitySaveModifier(), this.#getSituationalModifiers()];
	}

	/**
	 * Gets modifiers for a skill check.
	 * Includes the skill modifier and any situational modifiers.
	 */
	#getSkillCheckModifiers() {
		return [this.#getSkillCheckModifier(), this.#getSituationalModifiers()];
	}

	/** -------------------------------------- */
	/**         Ability Modifiers              */
	/** -------------------------------------- */

	/**
	 * Gets the ability modifier for the configured ability key.
	 * Only applies to character actors.
	 *
	 * @returns The ability modifier with localized label, or null if not applicable.
	 */
	#getAbilityModifier(): ModifierManager.Modifier | null {
		if (!this.actor.isType('character')) return null;

		const { abilityKey } = this.rollData;
		if (!abilityKey) return null;

		const abilities = (this.actor.system as unknown as NimbleActorSystemData).abilities;
		return {
			label: localize('NIMBLE.modifiers.abilityCheck', {
				ability: CONFIG.NIMBLE.abilityScores[abilityKey] ?? abilityKey,
			}),
			value: abilities?.[abilityKey]?.mod ?? 0,
		};
	}

	/** -------------------------------------- */
	/**        Saving Throw Modifiers          */
	/** -------------------------------------- */

	/**
	 * Gets the saving throw modifier for the configured save key.
	 *
	 * @returns The save modifier with localized label, or null if no save key configured.
	 */
	#getAbilitySaveModifier(): ModifierManager.Modifier | null {
		const { saveKey } = this.rollData;
		if (!saveKey) return null;

		const savingThrows = (this.actor.system as unknown as NimbleActorSystemData).savingThrows;
		return {
			label: localize('NIMBLE.modifiers.savingThrow', {
				saveType: CONFIG.NIMBLE.savingThrows[saveKey] ?? saveKey,
			}),
			value: savingThrows?.[saveKey]?.mod ?? 0,
		};
	}

	/** -------------------------------------- */
	/**         Skill Check Modifiers          */
	/** -------------------------------------- */

	/**
	 * Gets the skill modifier for the configured skill key.
	 * Only applies to character actors.
	 *
	 * @returns The skill modifier with localized label, or null if not applicable.
	 */
	#getSkillCheckModifier(): ModifierManager.Modifier | null {
		if (!this.actor.isType('character')) return null;

		const { skillKey } = this.rollData;
		if (!skillKey) return null;

		const skills = (this.actor.system as unknown as NimbleActorSystemData).skills;
		return {
			label: localize('NIMBLE.modifiers.skillCheck', {
				skill: CONFIG.NIMBLE.skills[skillKey] ?? skillKey,
			}),
			value: skills?.[skillKey]?.mod ?? 0,
		};
	}

	/** -------------------------------------- */
	/**             Other Modifiers            */
	/** -------------------------------------- */

	/**
	 * Gets situational modifiers provided by the user.
	 *
	 * These are ad-hoc modifiers entered during roll configuration,
	 * such as "+2 flanking" or "-4 cover".
	 *
	 * @returns A modifier containing the situational modifier formula (may be empty string).
	 */
	#getSituationalModifiers(): ModifierManager.Modifier | null {
		return { value: this.rollData.situationalMods ?? '' };
	}
}

export { ModifierManager };
