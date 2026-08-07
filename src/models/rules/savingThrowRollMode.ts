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
		// Free text rather than a closed set: the circumstances the rulebooks attach to
		// saves (poison, fear, being grabbed) span damage types, conditions and plain
		// prose, and none of the existing config vocabularies covers them.
		situation: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.savingThrowRollMode.situation.label',
			hint: 'NIMBLE.rules.savingThrowRollMode.situation.hint',
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

/**
 * This rule intentionally has NO data-prep hook: defaultRollMode is a
 * user-configurable persisted value. Rule contributions are calculated
 * on-demand by the "Reset to Class Defaults" button in
 * ActorSavingThrowConfigDialog.svelte and by the character creation flow,
 * so users can customize their saving throw roll modes while still being
 * able to reset to calculated defaults.
 *
 * A rule that names a `situation` only applies when that circumstance comes up
 * ("advantage against poison saves"), which a persisted default roll mode cannot
 * express. Both calculators skip those rules so the stored default stays correct,
 * and the saving throw config dialog lists them separately as reminders.
 */
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
				['situation', 'string'],
			]),
		);
	}
}

export { SavingThrowRollModeRule };
