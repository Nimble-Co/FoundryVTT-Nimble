// NimbleBaseActor and NimbleBaseItem types are available globally from .d.ts files

import localize from '../utils/localize.js';

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

	#getAbilityCheckModifiers() {
		if (this.actor.isType('soloMonster')) {
			return [this.#getSituationalModifiers()];
		}

		return [this.#getAbilityModifier(), this.#getSituationalModifiers()];
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
	#getSituationalModifiers(): ModifierManager.Modifier | null {
		return { value: this.rollData.situationalMods ?? '' };
	}
}

export { ModifierManager };
