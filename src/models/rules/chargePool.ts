import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHARGE_POOL_SCOPES = [...ChargePoolRuleConfig.scopes];
const CHARGE_POOL_DIE_SIZES = [...ChargePoolRuleConfig.dieSizes];
const CHARGE_POOL_INITIAL_VALUES = [...ChargePoolRuleConfig.initialModes];
const CHARGE_RECOVERY_TRIGGERS = [...ChargePoolRuleConfig.recoveryTriggers];
const CHARGE_RECOVERY_MODES = [...ChargePoolRuleConfig.recoveryModes];

function schema() {
	const { fields } = foundry.data;

	return {
		scope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			label: 'NIMBLE.rules.chargePool.scope.label',
			hint: 'NIMBLE.rules.chargePool.scope.hint',
			choices: CHARGE_POOL_SCOPES,
		}),
		max: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.chargePool.max.label',
				hint: 'NIMBLE.rules.chargePool.max.hint',
				widget: 'formula',
			}),
		),
		dieSize: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: 'NIMBLE.rules.chargePool.dieSize.label',
			hint: 'NIMBLE.rules.chargePool.dieSize.hint',
			choices: CHARGE_POOL_DIE_SIZES,
		}),
		initial: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'max',
			label: 'NIMBLE.rules.chargePool.initial.label',
			hint: 'NIMBLE.rules.chargePool.initial.hint',
			choices: CHARGE_POOL_INITIAL_VALUES,
		}),
		recoveries: new fields.ArrayField(
			new fields.SchemaField({
				trigger: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'safeRest',
					label: 'NIMBLE.rules.chargePool.recoveries.trigger.label',
					hint: 'NIMBLE.rules.chargePool.recoveries.trigger.hint',
					choices: CHARGE_RECOVERY_TRIGGERS,
				}),
				mode: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'add',
					label: 'NIMBLE.rules.chargePool.recoveries.mode.label',
					hint: 'NIMBLE.rules.chargePool.recoveries.mode.hint',
					choices: CHARGE_RECOVERY_MODES,
				}),
				value: new fields.StringField(
					withWidget({
						required: true,
						nullable: false,
						initial: '1',
						label: 'NIMBLE.rules.chargePool.recoveries.value.label',
						hint: 'NIMBLE.rules.chargePool.recoveries.value.hint',
						widget: 'formula',
					}),
				),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.chargePool.recoveries.label',
				hint: 'NIMBLE.rules.chargePool.recoveries.hint',
			} as unknown as never,
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'chargePool' }),
	};
}

declare namespace ChargePoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ChargePoolRule extends NimbleBaseRule<ChargePoolRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.chargePool.description';

	declare scope: (typeof ChargePoolRuleConfig.scopes)[number];

	declare max: string;

	declare dieSize: (typeof ChargePoolRuleConfig.dieSizes)[number] | null;

	declare initial: (typeof ChargePoolRuleConfig.initialModes)[number];

	static override defineSchema(): ChargePoolRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['scope', '"item" | "actor"'],
				['max', 'string'],
				['dieSize', '"d4" | "d6" | "d8" | "d10" | "d12" | "d20" | null'],
				['initial', '"max" | "zero"'],
				['recoveries', 'Array<{ trigger: string; mode: string; value: string }>'],
			]),
		);
	}
}

export { ChargePoolRule };
