import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		// Supports @-references (e.g. @dexterity). Use {value} in message to insert the result.
		formula: new fields.StringField({ required: true, nullable: false, initial: '' }),
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

	resolveMessage(): string {
		const value = this.resolveFormula(this.formula) ?? 0;
		return this.message.replaceAll('{value}', String(value));
	}
}

export { InitiativeMessageRule };
