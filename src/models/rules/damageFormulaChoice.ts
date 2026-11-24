import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		itemIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.damageFormulaChoice.itemIdentifier.label',
			hint: 'NIMBLE.rules.damageFormulaChoice.itemIdentifier.hint',
		}),
		from: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.damageFormulaChoice.from.label',
				hint: 'NIMBLE.rules.damageFormulaChoice.from.hint',
				widget: 'diceFormula',
			}),
		),
		to: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.damageFormulaChoice.to.label',
				hint: 'NIMBLE.rules.damageFormulaChoice.to.hint',
				widget: 'diceFormula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'damageFormulaChoice',
		}),
	};
}

declare namespace DamageFormulaChoiceRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A tick in the roll window that replaces one dice term of an attack's damage
 * when the attack uses a named item. The tick starts off. Read when the window
 * opens, never during data preparation.
 */
class DamageFormulaChoiceRule extends NimbleBaseRule<DamageFormulaChoiceRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.damageFormulaChoice.description';
	static override icon = 'fa-solid fa-right-left';

	declare itemIdentifier: string;
	declare from: string;
	declare to: string;

	static override defineSchema(): DamageFormulaChoiceRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['itemIdentifier', 'string'],
				['from', 'string'],
				['to', 'string'],
			]),
		);
	}
}

export { DamageFormulaChoiceRule };
