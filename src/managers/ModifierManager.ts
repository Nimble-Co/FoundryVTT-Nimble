// NimbleBaseActor and NimbleBaseItem types are available globally from .d.ts files

import localize from '../utils/localize.js';

// Interface for character system data with abilities and skills
interface CharacterSystemData {
	abilities: Record<string, { mod?: number }>;
	skills: Record<string, { mod?: number }>;
	savingThrows: Record<string, { mod?: number }>;
}

// Interface for actor system data with saving throws
interface ActorSystemData {
	savingThrows: Record<string, { mod?: number }>;
}

declare namespace ModifierManager {
	interface RollDataOptions {
		abilityKey?: string;
		item?: NimbleBaseItem | undefined;
		minRoll?: number | undefined;
		rollMode?: number | undefined;
		saveKey?: string | undefined;
		skillKey?: string | undefined;
		situationalMods?: string | undefined;
		type: 'abilityCheck' | 'savingThrow' | 'skillCheck';
	}

	type Modifier = { label?: string | undefined; value: number | string };
}

class ModifierManager {
	actor: NimbleBaseActor;

	rollData: ModifierManager.RollDataOptions;

	constructor(actor: NimbleBaseActor, rollData: ModifierManager.RollDataOptions) {
		this.actor = actor;
		this.rollData = rollData;
	}

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

	#getAbilityCheckModifiers(): ModifierManager.Modifier[] {
		if (this.actor.type === 'soloMonster') {
			const mod = this.#getSituationalModifiers();
			return mod ? [mod] : [];
		}

		const mods = [this.#getAbilityModifier(), this.#getSituationalModifiers()];
		return mods.filter((m): m is ModifierManager.Modifier => m !== null);
	}

	#getSavingThrowModifiers() {
		return [this.#getAbilitySaveModifier(), this.#getSituationalModifiers()];
	}

	#getSkillCheckModifiers() {
		return [this.#getSkillCheckModifier(), this.#getSituationalModifiers()];
	}

	/** -------------------------------------- */
	/**         Ability Modifiers              */
	/** -------------------------------------- */
	#getAbilityModifier(): ModifierManager.Modifier | null {
		if (this.actor.type !== 'character') return null;

		const { abilityKey } = this.rollData;
		if (!abilityKey) return null;

		const system = this.actor.system as unknown as CharacterSystemData;
		const modValue = system.abilities[abilityKey]?.mod;
		return {
			label: localize('NIMBLE.modifiers.abilityCheck', {
				ability: CONFIG.NIMBLE.abilityScores[abilityKey] ?? abilityKey,
			}),
			value: modValue ?? 0,
		};
	}

	/** -------------------------------------- */
	/**        Saving Throw Modifiers          */
	/** -------------------------------------- */
	#getAbilitySaveModifier(): ModifierManager.Modifier | null {
		const { saveKey } = this.rollData;
		if (!saveKey) return null;

		const system = this.actor.system as unknown as ActorSystemData;
		const modValue = system.savingThrows[saveKey]?.mod;
		return {
			label: localize('NIMBLE.modifiers.savingThrow', {
				saveType: CONFIG.NIMBLE.savingThrows[saveKey] ?? saveKey,
			}),
			value: modValue ?? 0,
		};
	}

	/** -------------------------------------- */
	/**         Skill Check Modifiers          */
	/** -------------------------------------- */
	#getSkillCheckModifier() {
		if (this.actor.type !== 'character') return null;

		const { skillKey } = this.rollData;
		if (!skillKey) return null;

		const system = this.actor.system as unknown as CharacterSystemData;
		const modValue = system.skills[skillKey]?.mod;
		return {
			label: localize('NIMBLE.modifiers.skillCheck', {
				skill: CONFIG.NIMBLE.skills[skillKey] ?? skillKey,
			}),
			value: modValue ?? 0,
		};
	}

	/** -------------------------------------- */
	/**             Other Modifiers            */
	/** -------------------------------------- */
	#getSituationalModifiers(): ModifierManager.Modifier | null {
		return { value: this.rollData.situationalMods ?? '' };
	}
}

export { ModifierManager };
