import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			label: 'NIMBLE.rules.savingThrowRollMode.value.label',
		}),
		target: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'all',
			label: 'NIMBLE.rules.savingThrowRollMode.target.label',
		}),
		// Only meaningful when `requiresChoice` is true — hidden otherwise.
		selectedSave: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: 'NIMBLE.rules.savingThrowRollMode.selectedSave.label',
			showWhen: (data) => data.requiresChoice === true,
		} as unknown as never),
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'set',
			label: 'NIMBLE.rules.savingThrowRollMode.mode.label',
			choices: ['set', 'adjust'],
		}),
		requiresChoice: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.savingThrowRollMode.requiresChoice.label',
		}),
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
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.savingThrowRollMode.description';

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
		// NOTE: This rule intentionally does NOT modify defaultRollMode during data prep.
		// The defaultRollMode is a user-configurable value that should persist.
		//
		// Rule contributions to roll modes are calculated on-demand by:
		// 1. The "Reset to Class Defaults" button in ActorSavingThrowConfigDialog.svelte
		// 2. Character creation flow
		//
		// This allows users to customize their saving throw roll modes while still
		// being able to reset to calculated defaults when needed.
	}
}

export { SavingThrowRollModeRule };
