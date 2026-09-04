import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHARGE_CONSUMER_SCOPES = [...ChargePoolRuleConfig.scopes];
const CHARGE_CONSUMER_COST_MODES = [...ChargePoolRuleConfig.costModes];

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				widget: 'chargePoolPicker',
			}),
		),
		poolScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			choices: CHARGE_CONSUMER_SCOPES,
		}),
		costMode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'fixed',
			label: 'NIMBLE.rules.chargeConsumer.costMode.label',
			hint: 'NIMBLE.rules.chargeConsumer.costMode.hint',
			choices: CHARGE_CONSUMER_COST_MODES,
		}),
		cost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.chargeConsumer.cost.label',
				hint: 'NIMBLE.rules.chargeConsumer.cost.hint',
				widget: 'formula',
			}),
		),
		maxCost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.chargeConsumer.maxCost.label',
				hint: 'NIMBLE.rules.chargeConsumer.maxCost.hint',
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

	/**
	 * `fixed` spends `cost` every activation. `variable` makes `cost` the
	 * smallest legal spend and asks the player for the rest, which is what a
	 * "spend any amount" pool needs.
	 */
	declare costMode: (typeof ChargePoolRuleConfig.costModes)[number];

	declare cost: string;

	/** Ceiling for a variable spend. Blank means the pool's current charges. */
	declare maxCost: string;

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
				['costMode', '"fixed" | "variable"'],
				['cost', 'string'],
				['maxCost', 'string'],
			]),
		);
	}
}

export { ChargeConsumerRule };
