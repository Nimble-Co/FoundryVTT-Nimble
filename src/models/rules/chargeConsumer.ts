import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHARGE_CONSUMER_SCOPES = [...ChargePoolRuleConfig.scopes];

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField({ required: true, nullable: false, initial: '' }),
		poolScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			choices: CHARGE_CONSUMER_SCOPES,
		}),
		cost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'chargeConsumer',
		}),
	};
}

declare namespace ChargeConsumerRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ChargeConsumerRule extends NimbleBaseRule<ChargeConsumerRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.chargeConsumer.description';

	declare poolIdentifier: string;

	declare poolScope: (typeof ChargePoolRuleConfig.scopes)[number];

	declare cost: string;

	static override defineSchema(): ChargeConsumerRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['poolScope', '"item" | "actor"'],
				['cost', 'string'],
			]),
		);
	}
}

export { ChargeConsumerRule };
