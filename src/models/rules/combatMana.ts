import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		formula: new fields.StringField({ required: true, nullable: false, initial: '0' }),
		resource: new fields.StringField({ required: true, nullable: false, initial: 'mana' }),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'initiativeRoll',
		}),
		clearOn: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'combatEnd',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'combatMana' }),
	};
}

declare namespace CombatManaRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class CombatManaRule extends NimbleBaseRule<CombatManaRule.Schema> {
	declare formula: string;
	declare resource: string;
	declare trigger: string;
	declare clearOn: string;

	static override defineSchema(): CombatManaRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['formula', 'string'],
				['resource', 'string'],
				['trigger', 'string'],
				['clearOn', 'string'],
			]),
		);
	}

	getGrantAmount(): number {
		const value = Number(this.resolveFormula(this.formula) ?? 0);
		return Math.max(0, value);
	}
}

export { CombatManaRule };
