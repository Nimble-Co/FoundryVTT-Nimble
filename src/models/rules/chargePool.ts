import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { NimbleBaseRule } from './base.js';

const CHARGE_POOL_SCOPES = [...ChargePoolRuleConfig.scopes];
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
			choices: CHARGE_POOL_SCOPES,
		}),
		max: new fields.StringField({ required: true, nullable: false, initial: '1' }),
		initial: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'max',
			choices: CHARGE_POOL_INITIAL_VALUES,
		}),
		recoveries: new fields.ArrayField(
			new fields.SchemaField({
				trigger: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'safeRest',
					choices: CHARGE_RECOVERY_TRIGGERS,
				}),
				mode: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'add',
					choices: CHARGE_RECOVERY_MODES,
				}),
				value: new fields.StringField({ required: true, nullable: false, initial: '1' }),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
			},
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'chargePool' }),
	};
}

declare namespace ChargePoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ChargePoolRule extends NimbleBaseRule<ChargePoolRule.Schema> {
	declare scope: (typeof ChargePoolRuleConfig.scopes)[number];

	declare max: string;

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
				['initial', '"max" | "zero"'],
				['recoveries', 'Array<{ trigger: string; mode: string; value: string }>'],
			]),
		);
	}
}

export { ChargePoolRule };
