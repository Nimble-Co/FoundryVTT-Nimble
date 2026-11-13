import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

export const TURN_DAMAGE_MOMENTS = ['turnStart', 'turnEnd'] as const;
export const TURN_DAMAGE_WHO = ['holder', 'nearby'] as const;

const key = (field: string, part: string) => `NIMBLE.rules.turnDamage.${field}.${part}`;

const choicesOf = (field: string, values: readonly string[]) =>
	Object.fromEntries(values.map((value) => [value, key(field, `choices.${value}`)]));

function schema() {
	const { fields } = foundry.data;
	return {
		at: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'turnStart',
			choices: choicesOf('at', TURN_DAMAGE_MOMENTS),
			label: key('at', 'label'),
			hint: key('at', 'hint'),
		}),
		who: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'holder',
			choices: choicesOf('who', TURN_DAMAGE_WHO),
			label: key('who', 'label'),
			hint: key('who', 'hint'),
		}),
		reach: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 1,
				initial: 1,
				label: key('reach', 'label'),
				hint: key('reach', 'hint'),
				showWhen: (data: Record<string, unknown>) => data.who === 'nearby',
			}),
		),
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
		wounds: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 0,
			label: key('wounds', 'label'),
			hint: key('wounds', 'hint'),
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'turnDamage' }),
	};
}

declare namespace TurnDamageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Damage, Wounds or both at each turn start or end of a creature: its holder, or each creature
 * within Reach of the holder. The active GM deals it (`dealTurnDamage`).
 */
class TurnDamageRule extends NimbleBaseRule<TurnDamageRule.Schema> {
	declare at: (typeof TURN_DAMAGE_MOMENTS)[number];
	declare who: (typeof TURN_DAMAGE_WHO)[number];
	declare reach: number;
	declare formula: string;
	declare damageType: keyof typeof CONFIG.NIMBLE.damageTypes | '';
	declare wounds: number;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.turnDamage.description';
	static override icon = 'fa-solid fa-fire-flame-curved';

	static override defineSchema(): TurnDamageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['at', TURN_DAMAGE_MOMENTS.map((value) => `'${value}'`).join(' | ')],
				['who', TURN_DAMAGE_WHO.map((value) => `'${value}'`).join(' | ')],
				['reach', 'number'],
				['formula', 'string'],
				['damageType', 'string'],
				['wounds', 'number'],
			]),
		);
	}

	override afterPrepareData(): void {
		if (this.isOnActor && this.formula.trim()) this.checkReferences(this.formula);
	}
}

export { TurnDamageRule };
