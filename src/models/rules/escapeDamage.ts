import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const key = (field: string, part: string) => `NIMBLE.rules.escapeDamage.${field}.${part}`;

function schema() {
	const { fields } = foundry.data;
	return {
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: key('formula', 'label'),
				hint: key('formula', 'hint'),
				widget: 'diceFormula',
			}),
		),
		damageType: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: key('damageType', 'label'),
			hint: key('damageType', 'hint'),
			choices: () => CONFIG.NIMBLE.damageTypes,
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'escapeDamage' }),
	};
}

declare namespace EscapeDamageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Damage to the holder when it escapes the effect this rule is on. The active GM deals it on the
 * roll card of the Escape (`dealEscapeDamage`).
 */
class EscapeDamageRule extends NimbleBaseRule<EscapeDamageRule.Schema> {
	declare formula: string;
	declare damageType: keyof typeof CONFIG.NIMBLE.damageTypes | '';

	static override worksOnItems = false;
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.escapeDamage.description';
	static override icon = 'fa-solid fa-person-running';
	static override formLayout: readonly RuleFormGroup[] = [{ fields: ['formula', 'damageType'] }];

	static override defineSchema(): EscapeDamageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['formula', 'string'],
				['damageType', 'string'],
			]),
		);
	}

	override afterPrepareData(): void {
		if (this.isOnActor && this.formula.trim()) this.checkReferences(this.formula);
	}
}

export { EscapeDamageRule };
