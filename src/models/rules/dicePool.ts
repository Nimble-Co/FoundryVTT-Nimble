import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const DICE_POOL_SCOPES = [...DicePoolRuleConfig.scopes];
const DICE_POOL_DIE_SIZES = [...DicePoolRuleConfig.dieSizes];
const DICE_POOL_INITIAL_VALUES = [...DicePoolRuleConfig.initialModes];
const DICE_REFILL_TRIGGERS = [...DicePoolRuleConfig.refillTriggers];
const DICE_REFILL_MODES = [...DicePoolRuleConfig.refillModes];

function schema() {
	const { fields } = foundry.data;

	return {
		scope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			label: 'NIMBLE.rules.dicePool.scope.label',
			hint: 'NIMBLE.rules.dicePool.scope.hint',
			choices: DICE_POOL_SCOPES,
		}),
		dieSize: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'd4',
			label: 'NIMBLE.rules.dicePool.dieSize.label',
			hint: 'NIMBLE.rules.dicePool.dieSize.hint',
			choices: DICE_POOL_DIE_SIZES,
		}),
		max: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.dicePool.max.label',
				hint: 'NIMBLE.rules.dicePool.max.hint',
				widget: 'formula',
			}),
		),
		initial: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'max',
			label: 'NIMBLE.rules.dicePool.initial.label',
			hint: 'NIMBLE.rules.dicePool.initial.hint',
			choices: DICE_POOL_INITIAL_VALUES,
		}),
		refills: new fields.ArrayField(
			new fields.SchemaField({
				trigger: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'safeRest',
					label: 'NIMBLE.rules.dicePool.refills.trigger.label',
					hint: 'NIMBLE.rules.dicePool.refills.trigger.hint',
					choices: DICE_REFILL_TRIGGERS,
				}),
				mode: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'add',
					label: 'NIMBLE.rules.dicePool.refills.mode.label',
					hint: 'NIMBLE.rules.dicePool.refills.mode.hint',
					choices: DICE_REFILL_MODES,
				}),
				value: new fields.StringField(
					withWidget({
						required: true,
						nullable: false,
						initial: '1',
						label: 'NIMBLE.rules.dicePool.refills.value.label',
						hint: 'NIMBLE.rules.dicePool.refills.value.hint',
						widget: 'formula',
					}),
				),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.dicePool.refills.label',
				hint: 'NIMBLE.rules.dicePool.refills.hint',
			} as unknown as never,
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'dicePool' }),
	};
}

declare namespace DicePoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class DicePoolRule extends NimbleBaseRule<DicePoolRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.dicePool.description';

	declare scope: (typeof DicePoolRuleConfig.scopes)[number];

	declare dieSize: (typeof DicePoolRuleConfig.dieSizes)[number];

	declare max: string;

	declare initial: (typeof DicePoolRuleConfig.initialModes)[number];

	static override defineSchema(): DicePoolRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['scope', '"item" | "actor"'],
				['dieSize', '"d4" | "d6" | "d8" | "d10" | "d12" | "d20"'],
				['max', 'string'],
				['initial', '"max" | "zero"'],
				['refills', 'Array<{ trigger: string; mode: string; value: string }>'],
			]),
		);
	}
}

export { DicePoolRule };
