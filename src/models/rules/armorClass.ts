import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		formula: new fields.StringField({ required: true, nullable: false, initial: '' }),
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'add',
			choices: ['add', 'multiply', 'override'],
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'armorClass' }),
	};
}

declare namespace ArmorClassRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ArmorClassRule extends NimbleBaseRule<ArmorClassRule.Schema> {
	static override defineSchema(): ArmorClassRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override afterPrepareData(): void {
		if (this.invalid) return;

		const { actor } = this;
		if (!actor || !actor.isType('character')) return;

		const value = this.resolveFormula(this.formula);
		if (!value) return;

		const part = {
			mode: this.mode,
			priority: this.priority,
			source: this.label,
			value,
		};

		actor.system.attributes.armor.components.push(part);
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['formula', 'string'],
				[
					'mode',
					"'add' <span class=\"nimble-type-summary__operator\">|</span> 'multiply' <span class=\"nimble-type-summary__operator\">|</span> 'override'",
				],
			]),
		);
	}
}

export { ArmorClassRule };
