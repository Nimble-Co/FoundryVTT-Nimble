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
