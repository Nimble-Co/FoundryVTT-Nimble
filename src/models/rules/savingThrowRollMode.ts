import type { NimbleCharacter } from '../../documents/actor/character.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
		target: new fields.StringField({ required: true, nullable: false, initial: 'all' }),
		selectedSave: new fields.StringField({ required: false, nullable: true, initial: null }),
		mode: new fields.StringField({ required: true, nullable: false, initial: 'set' }),
		requiresChoice: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'savingThrowRollMode',
		}),
	};
}

declare namespace SavingThrowRollModeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class SavingThrowRollModeRule extends NimbleBaseRule<SavingThrowRollModeRule.Schema> {
	static override defineSchema(): SavingThrowRollModeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['target', 'string'],
				['selectedSave', 'string | null'],
				['mode', '"set" | "adjust"'],
				['requiresChoice', 'boolean'],
			]),
		);
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		// Skip choice-based rules entirely during data prep - the selection was applied
		// during character creation and is stored in the character's saved data.
		// The rule data is only used by Reset to recalculate defaults.
		if (this.requiresChoice) return;

		const actor = item.actor as NimbleCharacter;
		const savingThrowKeys = Object.keys(CONFIG.NIMBLE.savingThrows);

		// Determine which saves to affect based on target
		const targetSaves = this.getTargetSaves(actor, savingThrowKeys);

		for (const saveKey of targetSaves) {
			const currentRollMode = actor.system.savingThrows[saveKey]?.defaultRollMode ?? 0;
			let newRollMode: number;

			if (this.mode === 'set') {
				newRollMode = this.value;
			} else {
				// adjust mode
				newRollMode = currentRollMode + this.value;
			}

			// Clamp to valid range (-3 to 3)
			newRollMode = Math.max(-3, Math.min(3, newRollMode));

			foundry.utils.setProperty(
				actor.system,
				`savingThrows.${saveKey}.defaultRollMode`,
				newRollMode,
			);
		}
	}

	private getTargetSaves(actor: NimbleCharacter, allSaveKeys: string[]): string[] {
		const { target, selectedSave } = this;

		// If a specific save was selected (for choice-based rules)
		if (selectedSave && allSaveKeys.includes(selectedSave)) {
			return [selectedSave];
		}

		// Handle specific save key targets
		if (allSaveKeys.includes(target)) {
			return [target];
		}

		// Handle special targets
		switch (target) {
			case 'all':
				return allSaveKeys;

			case 'advantaged':
				return allSaveKeys.filter((key) => {
					const rollMode = actor.system.savingThrows[key]?.defaultRollMode ?? 0;
					return rollMode > 0;
				});

			case 'disadvantaged':
				return allSaveKeys.filter((key) => {
					const rollMode = actor.system.savingThrows[key]?.defaultRollMode ?? 0;
					return rollMode < 0;
				});

			case 'neutral':
				return allSaveKeys.filter((key) => {
					const rollMode = actor.system.savingThrows[key]?.defaultRollMode ?? 0;
					return rollMode === 0;
				});

			default:
				return [];
		}
	}
}

export { SavingThrowRollModeRule };
