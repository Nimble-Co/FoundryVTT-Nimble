import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		/**
		 * A roll formula evaluated against the actor's roll data.
		 * Supports `@`-references such as `@dexterity`.
		 * The resolved numeric result is substituted for every `{value}`
		 * placeholder in the `message` field.
		 */
		formula: new fields.StringField({ required: true, nullable: false, initial: '' }),

		/**
		 * The whispered chat message shown to the owning player when they roll
		 * initiative.  Use `{value}` as a placeholder for the resolved `formula`.
		 * Example: `"You can move {value} spaces for free on your first turn!"`
		 */
		message: new fields.StringField({ required: true, nullable: false, initial: '' }),

		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'initiativeMessage',
		}),
	};
}

declare namespace InitiativeMessageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that whispers a calculated reminder to the owning player when they roll
 * initiative.  The `formula` is evaluated against the actor's roll data and its
 * result is substituted into every `{value}` token in `message`.
 *
 * This rule is feature-agnostic: any item can carry it by adding an entry with
 * `"type": "initiativeMessage"` to its `system.rules` array.
 */
class InitiativeMessageRule extends NimbleBaseRule<InitiativeMessageRule.Schema> {
	declare formula: string;
	declare message: string;

	static override defineSchema(): InitiativeMessageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['formula', 'string'],
				['message', 'string'],
			]),
		);
	}

	/**
	 * Evaluates `formula` against the actor's roll data and returns the
	 * `message` string with every `{value}` token replaced by the result.
	 */
	resolveMessage(): string {
		const value = this.resolveFormula(this.formula) ?? 0;
		return this.message.replaceAll('{value}', String(value));
	}
}

export { InitiativeMessageRule };
