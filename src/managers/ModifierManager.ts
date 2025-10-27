import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import type { NimbleBaseItem } from '../documents/item/base.svelte.js';
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

		return {
			label: localize('NIMBLE.modifiers.abilityCheck', {
				ability: CONFIG.NIMBLE.abilityScores[abilityKey] ?? abilityKey,
			}),
			value: this.actor.system.abilities[abilityKey]?.mod ?? null,
		};
	}

	/** -------------------------------------- */
	/**        Saving Throw Modifiers          */
	/** -------------------------------------- */
	#getAbilitySaveModifier(): ModifierManager.Modifier | null {
		const { saveKey } = this.rollData;
		if (!saveKey) return null;

		return {
			label: localize('NIMBLE.modifiers.savingThrow', {
				saveType: CONFIG.NIMBLE.savingThrows[saveKey] ?? saveKey,
			}),
			value: this.actor.system.savingThrows[saveKey]?.mod ?? null,
		};
	}

	/** -------------------------------------- */
	/**         Skill Check Modifiers          */
	/** -------------------------------------- */
	#getSkillCheckModifier() {
		if (!this.actor.isType('character')) return null;

		const { skillKey } = this.rollData;
		if (!skillKey) return null;

		return {
			label: localize('NIMBLE.modifiers.skillCheck', {
				skill: CONFIG.NIMBLE.skills[skillKey] ?? skillKey,
			}),
			value: this.actor.system.skills[skillKey]?.mod ?? null,
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
